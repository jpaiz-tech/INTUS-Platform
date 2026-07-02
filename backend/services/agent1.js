import Anthropic from '@anthropic-ai/sdk';
import nodeFetch from 'node-fetch';
import https from 'https';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { detectDashboardOverlap } from './dashboardUtils.js';
import supabase from '../utils/supabaseClient.js';
import { getPriorResearch } from '../utils/getPriorResearch.js';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const RUNS_DIR    = path.resolve(__dirname, '../data/runs');
const PROMPTS_DIR = path.resolve(__dirname, '../prompts');
const MOCK_FILE   = path.resolve(__dirname, '../../data/mock/agent1_sample.txt');

const USE_CLAUDE_API      = process.env.USE_CLAUDE_API === 'true';
const MOCK_API            = process.env.MOCK_API === 'true';
const MODEL               = process.env.ANTHROPIC_MODEL  || 'claude-sonnet-4-6';
const MAX_TOKENS          = parseInt(process.env.MAX_OUTPUT_TOKENS || '8000', 10);
const ENABLE_WEB_SEARCH   = process.env.ENABLE_WEB_SEARCH === 'true';
const WEB_SEARCH_MAX_USES = parseInt(process.env.WEB_SEARCH_MAX_USES || '8', 10);

const httpsAgent = new https.Agent({ keepAlive: false });
function makeFetch(url, options = {}) {
  return nodeFetch(url, { ...options, agent: httpsAgent });
}

const RETRYABLE = ['premature close', 'econnreset', 'econnrefused', 'socket hang up', 'network error', 'fetch failed'];
function isRetryable(err) {
  return RETRYABLE.some(s => (err?.message || '').toLowerCase().includes(s));
}

async function saveRun(run) {
  await fs.mkdir(RUNS_DIR, { recursive: true });
  await fs.writeFile(path.join(RUNS_DIR, `${run.id}.json`), JSON.stringify(run, null, 2), 'utf8');
  return run;
}

function computeResearchMode(industry, realEstateType, company) {
  const hasI = !!industry;
  const hasT = !!realEstateType;
  const hasC = !!company;
  if (hasI && hasT && hasC) return 'industry_company_type';
  if (hasI && hasC)          return 'industry_company';
  if (hasC && hasT)          return 'company_type';
  if (hasI && hasT)          return 'industry_type';
  if (hasC)                  return 'company';
  return 'industry';
}

function buildUserMessage({
  industry, realEstateType, company,
  researchMode, isExistingSectorAddon, matchedSectorName,
  dashboardContext, dashboardOverlap,
}) {
  const lines = [];

  // ── Research Inputs block ────────────────────────────────────────────────
  lines.push('Research Inputs:');
  lines.push(`Industry: ${industry || 'NOT PROVIDED — infer from Company'}`);
  lines.push(`Real Estate Type / Subsection: ${realEstateType || 'NOT PROVIDED'}`);
  lines.push(`Reference Operator (research seed only — do not use for scoring): ${company || 'NOT PROVIDED'}`);
  lines.push(`Research Mode: ${researchMode}`);
  lines.push('');

  // ── Scope Interpretation block ────────────────────────────────────────────
  lines.push('Scope Interpretation:');

  lines.push('- Industry is the main sector. Research it as a real estate tenant category.');

  if (realEstateType) {
    lines.push(`- Real Estate Type "${realEstateType}" is REQUIRED COVERAGE in this report.`);
    lines.push('  This format must receive a full Deep Dive in Section 2.');
    lines.push('  It is NOT the exclusive scope. Also screen all other material formats:');
    lines.push('  Retail / Customer-Facing, Industrial / Warehouse / Distribution,');
    lines.push('  Cold Storage / Specialized Logistics, Office / HQ / Back Office, Specialized / Emerging Formats.');
    lines.push('  Do NOT exclude or skip other material formats because a Real Estate Type was provided.');
  } else {
    lines.push('- No Real Estate Type specified. Research all material real estate formats.');
  }

  if (company && industry) {
    lines.push(`- Company "${company}" is an anchor/operator example. Use it to ground evidence.`);
    lines.push('  Keep the report industry-level. Do NOT make it a company-only memo.');
    lines.push(`  Verify whether "${company}" belongs in the "${industry}" sector. Flag clearly if it does not.`);
  } else if (company && !industry) {
    lines.push(`- Company "${company}" is provided without an Industry.`);
    lines.push(`  Classify "${company}" into its primary industry sector. Research that industry as a tenant category.`);
    lines.push(`  Use "${company}" as the primary anchor operator. Do NOT write a company-only memo.`);
    lines.push('  The report must cover the full industry across all material real estate formats.');
  }

  if (isExistingSectorAddon && matchedSectorName) {
    lines.push('');
    lines.push('Add-On Context (IMPORTANT):');
    lines.push(`- Existing dashboard sector: "${matchedSectorName}"`);
    lines.push('- This run is an add-on report, NOT a duplicate sector report.');
    lines.push('- Do NOT recreate the full existing sector. Focus on the new type / company angle.');
    lines.push('- Briefly screen all format buckets to maintain sector context.');
    lines.push('- In Section 1, state clearly: Report type = Existing sector add-on.');
  }

  lines.push('');

  // ── Forbidden patterns ───────────────────────────────────────────────────
  if (realEstateType || company) {
    lines.push('Forbidden framing:');
    if (realEstateType) {
      lines.push(`- "Industrial is out of scope" — WRONG. Screen all buckets.`);
      lines.push(`- "Retail excluded because Type = ${realEstateType}" — WRONG.`);
      lines.push(`- "${realEstateType}-only report" — WRONG.`);
    }
    if (company) {
      lines.push(`- "${company}-only report" — WRONG. Report must be industry-level.`);
    }
    lines.push('');
  }

  // ── Dashboard Context block ──────────────────────────────────────────────
  if (dashboardContext?.sectorNames?.length > 0) {
    lines.push('Dashboard Context:');
    lines.push(`Existing sectors: ${dashboardContext.sectorNames.join(', ')}`);
    if (dashboardOverlap?.possibleOverlap) {
      lines.push(`Overlap warning: ${dashboardOverlap.warning}`);
    } else {
      lines.push('No sector-level overlap detected for this combination.');
    }
  }

  return lines.join('\n');
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * runAgent1({ industry, realEstateType, company,
 *             researchModeOverride, isExistingSectorAddon, matchedSectorName })
 *
 * Backward-compatible: can still be called as runAgent1('Industry string').
 */
export async function runAgent1(inputOrIndustry) {
  let industry, realEstateType, company, researchModeOverride, isExistingSectorAddon, matchedSectorName;

  if (typeof inputOrIndustry === 'string') {
    industry = inputOrIndustry;
    realEstateType = '';  company = '';
    researchModeOverride = null;  isExistingSectorAddon = false;  matchedSectorName = null;
  } else {
    industry             = inputOrIndustry.industry             || '';
    realEstateType       = inputOrIndustry.realEstateType       || '';
    company              = inputOrIndustry.company              || '';
    researchModeOverride  = inputOrIndustry.researchModeOverride || null;
    isExistingSectorAddon = inputOrIndustry.isExistingSectorAddon || false;
    matchedSectorName     = inputOrIndustry.matchedSectorName    || null;
  }

  const id          = uuidv4();
  const createdAt   = new Date().toISOString();
  const mode        = (USE_CLAUDE_API && !MOCK_API) ? 'claude-api' : 'mock-api';
  const researchMode = researchModeOverride || computeResearchMode(industry, realEstateType, company);

  const baseRun = {
    id,
    industry,
    realEstateType,
    company,
    researchMode,
    isExistingSectorAddon,
    matchedSectorName,
    status: 'pending', createdAt, updatedAt: createdAt,
    agent: 'agent1', model: MODEL, mode,
    webSearchEnabled:     ENABLE_WEB_SEARCH,
    dashboardOverlap:     null,
    dashboardContextUsed: false,
    rawOutput: '', usage: null, error: null,
  };

  // ── Mock fallback ──────────────────────────────────────────────────────────
  if (MOCK_API || !USE_CLAUDE_API) {
    let template;
    try {
      template = await fs.readFile(MOCK_FILE, 'utf8');
    } catch (err) {
      return saveRun({ ...baseRun, model: 'mock-api', mode: 'mock-api', status: 'failed',
        updatedAt: new Date().toISOString(), error: `Could not read mock file: ${err.message}` });
    }
    return saveRun({ ...baseRun, model: 'mock-api', mode: 'mock-api', status: 'completed',
      updatedAt: new Date().toISOString(),
      rawOutput: template.replaceAll('{{industry}}', industry || company || 'Unknown') });
  }

  // ── Claude API mode ────────────────────────────────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    return saveRun({ ...baseRun, status: 'failed', updatedAt: new Date().toISOString(),
      error: 'ANTHROPIC_API_KEY is not set. Add it to .env.' });
  }

  let systemPrompt;
  try {
    systemPrompt = (await fs.readFile(path.join(PROMPTS_DIR, 'agent1.txt'), 'utf8')).trim();
  } catch (err) {
    return saveRun({ ...baseRun, status: 'failed', updatedAt: new Date().toISOString(),
      error: `Could not read agent1.txt: ${err.message}` });
  }
  if (!systemPrompt) {
    return saveRun({ ...baseRun, status: 'failed', updatedAt: new Date().toISOString(),
      error: 'agent1.txt is empty — cannot run with a blank system prompt.' });
  }

  // ── Dashboard context for user message (from Supabase) ───────────────────
  let dashboardContext = null;
  let dashboardOverlap = { possibleOverlap: false, matches: [], warning: '' };

  if (supabase) {
    try {
      const { data: sectors } = await supabase
        .from('industries')
        .select('name, score, score_exact, assets, sub')
        .order('score', { ascending: false });

      if (sectors?.length > 0) {
        dashboardContext = {
          existingSectors: sectors,
          sectorNames:     sectors.map(s => s.name),
        };
        dashboardOverlap = detectDashboardOverlap({ industry, realEstateType, company, dashboardContext });
      }
    } catch (ctxErr) {
      console.warn('[agent1] Could not fetch dashboard context — overlap detection skipped:', ctxErr.message);
    }
  }

  baseRun.dashboardOverlap     = dashboardOverlap;
  baseRun.dashboardContextUsed = dashboardContext !== null;

  // ── Build user message ─────────────────────────────────────────────────────
  const baseUserMessage = buildUserMessage({
    industry, realEstateType, company,
    researchMode, isExistingSectorAddon, matchedSectorName,
    dashboardContext, dashboardOverlap,
  });

  // ── Prior research context ─────────────────────────────────────────────────
  // Look up by matched sector name first (exact dashboard match), then raw industry input
  let priorResearch = null;
  try {
    priorResearch = await getPriorResearch(matchedSectorName || industry);
  } catch {
    // Non-fatal — fall back to first-run behavior
  }

  const userMessage = priorResearch
    ? `${priorResearch}\n\n---\n\n${baseUserMessage}`
    : baseUserMessage;

  baseRun.priorResearchFound = !!priorResearch;

  console.log(`[agent1] calling Claude API`);
  console.log(`[agent1]   model:            ${MODEL}`);
  console.log(`[agent1]   max_tokens:       ${MAX_TOKENS}`);
  console.log(`[agent1]   researchMode:     ${researchMode}`);
  console.log(`[agent1]   industry:         ${industry || '(none)'}`);
  if (realEstateType)       console.log(`[agent1]   realEstateType:   ${realEstateType}`);
  if (company)              console.log(`[agent1]   company:          ${company}`);
  if (isExistingSectorAddon) console.log(`[agent1]   existingAddon:    ${matchedSectorName}`);
  console.log(`[agent1]   webSearch:        ${ENABLE_WEB_SEARCH}`);
  if (ENABLE_WEB_SEARCH)    console.log(`[agent1]   wsMaxUses:        ${WEB_SEARCH_MAX_USES}`);

  const client = new Anthropic({
    apiKey:         process.env.ANTHROPIC_API_KEY,
    fetch:          makeFetch,
    timeout:        300_000,
    maxRetries:     0,
    defaultHeaders: { 'anthropic-beta': 'prompt-caching-2024-07-31' },
  });

  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (attempt > 1) console.log(`[agent1] retry attempt ${attempt}: ${lastError.message}`);

      const createParams = {
        model:      MODEL,
        max_tokens: MAX_TOKENS,
        system:     [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages:   [{ role: 'user', content: userMessage }],
      };
      if (ENABLE_WEB_SEARCH) {
        createParams.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: WEB_SEARCH_MAX_USES }];
      }

      const message   = await client.messages.create(createParams);
      const rawOutput = message.content.filter(b => b.type === 'text').map(b => b.text).join('\n');

      console.log(`[agent1] success — input: ${message.usage.input_tokens}, output: ${message.usage.output_tokens}`);

      return saveRun({
        ...baseRun,
        status: 'completed', updatedAt: new Date().toISOString(),
        rawOutput,
        usage: { input_tokens: message.usage.input_tokens, output_tokens: message.usage.output_tokens },
      });
    } catch (err) {
      lastError = err;
      console.error(`[agent1] attempt ${attempt} failed: ${err.message}`);
      if (attempt === 1 && isRetryable(err)) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      break;
    }
  }

  return saveRun({ ...baseRun, status: 'failed', updatedAt: new Date().toISOString(),
    error: lastError?.message || 'Unknown error' });
}
