import Anthropic from '@anthropic-ai/sdk';
import nodeFetch from 'node-fetch';
import https from 'https';
import fs from 'fs/promises';
import { readFileSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import supabase from '../utils/supabaseClient.js';
import {
  insertSectorIntoHtml,
  transformSectorObject,
  validateParsedOutput,
  extractDashboardContext,
  normalizeSectorName,
} from './dashboardUtils.js';
import { mergeSectors } from './sectorUtils.js';
import { writeSectorToDatabase } from './sectorDb.js';

const __dirname        = path.dirname(fileURLToPath(import.meta.url));
const RUNS_DIR         = path.resolve(__dirname, '../data/runs');
const PROMPTS_DIR      = path.resolve(__dirname, '../prompts');
const ANTI_AI_STYLE    = path.resolve(__dirname, '../reference/ANTI-AI-WRITING-STYLE.md');

const MODEL      = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const MAX_TOKENS = parseInt(process.env.AGENT3_MAX_OUTPUT_TOKENS || '11500', 10);

const httpsAgent = new https.Agent({ keepAlive: false });
function makeFetch(url, options = {}) {
  return nodeFetch(url, { ...options, agent: httpsAgent });
}

const RETRYABLE = ['premature close', 'econnreset', 'econnrefused', 'socket hang up', 'network error', 'fetch failed'];

function cleanAndParseAgent3JSON(raw) {
  // Strip markdown fences
  let cleaned = raw.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/im, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (firstErr) {
    // Remove trailing commas before } or ]
    const noTrailing = cleaned.replace(/,(\s*[}\]])/g, '$1');
    try {
      return JSON.parse(noTrailing);
    } catch {
      // Extract from first { or [ to last } or ]
      const start = cleaned.search(/[{[]/);
      const lastBrace   = cleaned.lastIndexOf('}');
      const lastBracket = cleaned.lastIndexOf(']');
      const end = Math.max(lastBrace, lastBracket);
      if (start !== -1 && end > start) {
        const extracted = cleaned.slice(start, end + 1).replace(/,(\s*[}\]])/g, '$1');
        try { return JSON.parse(extracted); } catch { /* fall through */ }
      }
      throw firstErr;
    }
  }
}
function isRetryable(err) {
  return RETRYABLE.some(s => (err?.message || '').toLowerCase().includes(s));
}

async function saveRun(run) {
  await fs.mkdir(RUNS_DIR, { recursive: true });
  await fs.writeFile(path.join(RUNS_DIR, `${run.id}.json`), JSON.stringify(run, null, 2), 'utf8');
  return run;
}

function toSlug(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')          // strip combining diacritical marks
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function tier(s) { return s >= 85 ? 'A+' : s >= 75 ? 'A' : s >= 60 ? 'B' : s >= 45 ? 'C' : 'D'; }

// ── Main export ────────────────────────────────────────────────────────────────

export async function runAgent3({
  agent1RunId,
  agent2RunId,
  agent1RunData = null,
  agent2RunData = null,
  updateDashboard      = true,
  dashboardWriteMode   = 'copy',
  overwriteExisting    = false,
}) {
  const id        = uuidv4();
  const createdAt = new Date().toISOString();

  const baseRun = {
    id,
    industry:           '',
    realEstateType:     '',
    company:            '',
    researchMode:       'industry',
    dashboardOverlap:   null,
    status:             'pending',
    createdAt,
    updatedAt:          createdAt,
    agent:              'agent3',
    parentAgent1RunId:  agent1RunId,
    parentAgent2RunId:  agent2RunId,
    model:              MODEL,
    mode:               'claude-api',
    webSearchEnabled:   false,
    maxOutputTokens:    MAX_TOKENS,
    rawOutput:          '',
    parsedOutput:       null,
    sectorObject:       null,
    dashboardUpdated:   false,
    dashboardWriteMode: dashboardWriteMode,
    dashboardFilePath:  null,
    dashboardOutputPath: null,
    dashboardOutputUrl: null,
    dashboardBackupPath: null,
    warnings:                [],
    usage:                   null,
    error:                   null,
    dashboardSectorListUsed: null,
    mergeMode:               null,
    tabsAdded:               [],
  };

  // ── Load and validate Agent 1 run ──────────────────────────────────────────
  let run1 = agent1RunData || null;
  if (!run1) {
    try {
      run1 = JSON.parse(await fs.readFile(path.join(RUNS_DIR, `${agent1RunId}.json`), 'utf8'));
    } catch {
      return { error: `Agent 1 run not found: ${agent1RunId}`, status: 400 };
    }
  }
  if (run1.agent !== 'agent1')  return { error: `Run ${agent1RunId} is not an Agent 1 run.`, status: 400 };
  if (!run1.rawOutput?.trim())  return { error: `Agent 1 run ${agent1RunId} has no output.`, status: 400 };

  // ── Load and validate Agent 2 run ──────────────────────────────────────────
  let run2 = agent2RunData || null;
  if (!run2) {
    try {
      run2 = JSON.parse(await fs.readFile(path.join(RUNS_DIR, `${agent2RunId}.json`), 'utf8'));
    } catch {
      return { error: `Agent 2 run not found: ${agent2RunId}`, status: 400 };
    }
  }
  if (run2.agent !== 'agent2')  return { error: `Run ${agent2RunId} is not an Agent 2 run.`, status: 400 };
  if (!run2.rawOutput?.trim())  return { error: `Agent 2 run ${agent2RunId} has no output.`, status: 400 };

  baseRun.industry       = run1.industry       || '';
  baseRun.realEstateType = run1.realEstateType || '';
  baseRun.company        = run1.company        || '';
  baseRun.researchMode   = run1.researchMode   || 'industry';
  baseRun.dashboardOverlap = run1.dashboardOverlap || null;

  // ── Guard: need Claude API ─────────────────────────────────────────────────
  if (process.env.USE_CLAUDE_API !== 'true') {
    return saveRun({ ...baseRun, status: 'failed', updatedAt: new Date().toISOString(),
      error: 'USE_CLAUDE_API is not true. Set USE_CLAUDE_API=true in .env.' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return saveRun({ ...baseRun, status: 'failed', updatedAt: new Date().toISOString(),
      error: 'ANTHROPIC_API_KEY is not set.' });
  }

  // ── Read prompt ────────────────────────────────────────────────────────────
  let systemPrompt;
  try {
    const antiAiStyle = readFileSync(ANTI_AI_STYLE, 'utf8').trim();
    const agentPrompt = (await fs.readFile(path.join(PROMPTS_DIR, 'agent3.txt'), 'utf8')).trim();
    if (!agentPrompt) throw new Error('agent3.txt is empty');
    systemPrompt = antiAiStyle + '\n\n---\n\n' + agentPrompt;
  } catch (err) {
    return saveRun({ ...baseRun, status: 'failed', updatedAt: new Date().toISOString(),
      error: `Could not read prompt files: ${err.message}` });
  }

  const a3ScopeLines = [];
  if (run1.industry)       a3ScopeLines.push(`Industry: ${run1.industry}`);
  if (run1.realEstateType)  a3ScopeLines.push(`Real Estate Type: ${run1.realEstateType}`);
  if (run1.company)         a3ScopeLines.push(`Reference Operator: ${run1.company}`);
  a3ScopeLines.push(`Agent 1 Run ID: ${agent1RunId}`);
  a3ScopeLines.push(`Agent 2 Run ID: ${agent2RunId}`);
  if (run1.dashboardOverlap?.possibleOverlap) {
    a3ScopeLines.push(`Dashboard overlap warning: ${run1.dashboardOverlap.warning}`);
  }

  // ── Dashboard sector list for cross-calibration (from Supabase) ──────────
  let dashboardSectorListUsed = null;
  if (supabase) {
    try {
      const { data: calibSectors } = await supabase
        .from('industries')
        .select('name, score, score_exact, sub')
        .order('score', { ascending: false });

      if (calibSectors?.length > 0) {
        dashboardSectorListUsed = calibSectors
          .map(s => `${s.name} | final:${s.score}`)
          .join('\n');
      }
    } catch {
      // non-fatal: continue without sector list
    }
  }
  baseRun.dashboardSectorListUsed = dashboardSectorListUsed;

  const dashboardListBlock = dashboardSectorListUsed
    ? `\nDashboard sectors for calibration:\n${dashboardSectorListUsed}\n`
    : '';

  const userMessage =
    a3ScopeLines.join('\n') +
    dashboardListBlock +
    `\n\nBelow is Agent 1 research:\n\n${run1.rawOutput}\n\n` +
    `Below is Agent 2 QA and corrections:\n\n${run2.rawOutput}\n\n` +
    `Build the final dashboard-ready sector object and scoring package.`;

  console.log(`[agent3] calling Claude API`);
  console.log(`[agent3]   model:           ${MODEL}`);
  console.log(`[agent3]   max_tokens:      ${MAX_TOKENS}`);
  console.log(`[agent3]   industry:        ${run1.industry}`);
  console.log(`[agent3]   agent1RunId:     ${agent1RunId}`);
  console.log(`[agent3]   agent2RunId:     ${agent2RunId}`);
  console.log(`[agent3]   webSearch:       DISABLED (Agent 3 does not browse)`);

  const client = new Anthropic({
    apiKey:         process.env.ANTHROPIC_API_KEY,
    fetch:          makeFetch,
    timeout:        300_000,
    maxRetries:     0,
    defaultHeaders: { 'anthropic-beta': 'prompt-caching-2024-07-31' },
  });

  let lastError;
  let message;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (attempt > 1) console.log(`[agent3] retry attempt ${attempt} after: ${lastError.message}`);

      message = await client.messages.create({
        model:      MODEL,
        max_tokens: MAX_TOKENS,
        system:     [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages:   [{ role: 'user', content: userMessage }],
        // Web search intentionally omitted — Agent 3 scores only, does not research
      });
      break;
    } catch (err) {
      lastError = err;
      console.error(`[agent3] attempt ${attempt} failed: ${err.message}`);
      if (attempt === 1 && isRetryable(err)) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      return saveRun({ ...baseRun, status: 'failed', updatedAt: new Date().toISOString(),
        error: err.message || 'Unknown error' });
    }
  }

  const rawOutput   = message.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  const isTruncated = message.stop_reason === 'max_tokens';

  console.log(`[agent3] success — input: ${message.usage.input_tokens}, output: ${message.usage.output_tokens}, stop: ${message.stop_reason}`);
  if (isTruncated) console.warn('[agent3] WARNING: output truncated — increase AGENT3_MAX_OUTPUT_TOKENS');

  const usage = { input_tokens: message.usage.input_tokens, output_tokens: message.usage.output_tokens };

  if (isTruncated) {
    return saveRun({
      ...baseRun, status: 'truncated', updatedAt: new Date().toISOString(),
      rawOutput, usage,
      warnings: ['Agent 3 output was cut off. Increase AGENT3_MAX_OUTPUT_TOKENS.'],
    });
  }

  // ── Parse JSON ─────────────────────────────────────────────────────────────
  let parsedOutput;
  try {
    parsedOutput = cleanAndParseAgent3JSON(rawOutput);
  } catch (parseErr) {
    console.error('[agent3] JSON parse failed:', parseErr.message);
    return saveRun({
      ...baseRun, status: 'failed', updatedAt: new Date().toISOString(),
      rawOutput, usage,
      error: `Agent 3 returned invalid JSON. Dashboard not updated. Parse error: ${parseErr.message}`,
    });
  }

  // ── Validate ───────────────────────────────────────────────────────────────
  const validationErrors = validateParsedOutput(parsedOutput);
  if (validationErrors.length > 0) {
    console.error('[agent3] validation errors:', validationErrors);
    return saveRun({
      ...baseRun, status: 'failed', updatedAt: new Date().toISOString(),
      rawOutput, parsedOutput, usage,
      error: `sectorObject validation failed: ${validationErrors.join('; ')}`,
    });
  }

  // ── Transform sectorObject to dashboard format ─────────────────────────────
  const dashboardSectorObject = transformSectorObject(parsedOutput);

  // ── Dashboard file operations ──────────────────────────────────────────────
  const run = {
    ...baseRun,
    status:       'completed',
    updatedAt:    new Date().toISOString(),
    rawOutput,
    parsedOutput,
    sectorObject: dashboardSectorObject,
    usage,
  };

  // ── Ensure scoreExact is always a float with one decimal ──────────────────
  dashboardSectorObject.scoreExact = Math.round(
    parseFloat(dashboardSectorObject.scoreExact ?? dashboardSectorObject.score ?? 0) * 10
  ) / 10;

  // ── Write sector to Supabase FIRST (before dashboard, so it always runs) ──
  if (supabase && dashboardSectorObject) {
    try {
      let finalSector = dashboardSectorObject;
      let mergeMode   = 'created';
      let tabsAdded   = [];

      // Check if sector already exists and merge if so
      const { data: existingRow } = await supabase
        .from('sectors')
        .select('sector_data')
        .eq('name', dashboardSectorObject.name)
        .maybeSingle();

      if (existingRow?.sector_data) {
        const result = mergeSectors(existingRow.sector_data, dashboardSectorObject);
        finalSector  = result.merged;
        mergeMode    = result.mode;
        tabsAdded    = result.newTabs.map(t => t.shortLabel);
        console.log(`[agent3] sector merge mode: ${mergeMode}, tabs added: ${tabsAdded.join(', ') || 'none'}`);
      }

      run.mergeMode    = mergeMode;
      run.tabsAdded    = tabsAdded;
      run.sectorObject = finalSector;

      await writeSectorToDatabase(finalSector, id, {
        industry:         baseRun.industry,
        company:          baseRun.company,
        realEstateType:   baseRun.realEstateType,
        researchMode:     baseRun.researchMode,
        hasPriorResearch: baseRun.priorResearchFound || false,
      });
      console.log(`[agent3] sector written to Supabase: ${finalSector.name} (${mergeMode})`);
    } catch (sbErr) {
      run.warnings.push(`Supabase write exception: ${sbErr.message}`);
      console.warn('[agent3] Supabase exception:', sbErr.message);
    }
  }

  // ── Dashboard file operations (optional — Supabase already written above) ──
  if (!updateDashboard || dashboardWriteMode === 'none') {
    run.dashboardWriteMode = 'none';
    return saveRun(run);
  }

  const dashboardFilePath = process.env.DASHBOARD_FILE_PATH;
  if (!dashboardFilePath) {
    run.warnings.push('DASHBOARD_FILE_PATH not set. Dashboard file not updated.');
    return saveRun(run);
  }

  let originalHtml;
  try {
    originalHtml = await fs.readFile(dashboardFilePath, 'utf8');
    run.dashboardFilePath = dashboardFilePath;
  } catch {
    run.warnings.push('Dashboard file not found. Dashboard file not updated.');
    return saveRun(run);
  }

  // ── Enhanced normalized duplicate pre-check ───────────────────────────────
  try {
    const dashCtx = extractDashboardContext(originalHtml);
    if (dashCtx?.existingSectors?.length > 0) {
      const newNameNorm = normalizeSectorName(dashboardSectorObject.name);
      const newSubNorm  = normalizeSectorName(dashboardSectorObject.sub || '');

      for (const existing of dashCtx.existingSectors) {
        const exNameNorm = normalizeSectorName(existing.name);

        if (newNameNorm && exNameNorm && newNameNorm !== exNameNorm && (
          newNameNorm.includes(exNameNorm) || exNameNorm.includes(newNameNorm)
        )) {
          run.warnings.push(
            `Sector "${dashboardSectorObject.name}" may overlap with existing sector "${existing.name}" (normalized name match).`
          );
        }

        if (newSubNorm && newSubNorm.length > 4) {
          for (const tab of (existing.tabs || [])) {
            const tabNorm = normalizeSectorName(tab.label);
            if (tabNorm && (tabNorm.includes(newSubNorm) || newSubNorm.includes(tabNorm))) {
              run.warnings.push(
                `Sector subtitle "${dashboardSectorObject.sub}" may overlap with tab "${tab.label}" in existing sector "${existing.name}".`
              );
            }
          }
        }
      }
    }
  } catch {
    // Non-fatal
  }

  // ── Mutate HTML in memory ──────────────────────────────────────────────────
  const { html: updatedHtml, warning: insertWarning, duplicate } = insertSectorIntoHtml(
    originalHtml, dashboardSectorObject, overwriteExisting
  );

  if (insertWarning) {
    run.warnings.push(insertWarning);
    return saveRun(run);
  }

  // ── Write dashboard file ───────────────────────────────────────────────────
  const outputDir = process.env.DASHBOARD_OUTPUT_DIR
    || path.resolve(__dirname, '../../data/dashboard-outputs');

  await fs.mkdir(outputDir, { recursive: true });

  const shortId  = id.slice(0, 6);
  const filename = `dashboard-${toSlug(run1.industry)}-${shortId}.html`;

  if (dashboardWriteMode === 'copy') {
    const outputPath = path.join(outputDir, filename);
    await fs.writeFile(outputPath, updatedHtml, 'utf8');
    run.dashboardUpdated    = true;
    run.dashboardOutputPath = outputPath;
    run.dashboardOutputUrl  = `/dashboard-outputs/${filename}`;
    console.log(`[agent3] dashboard copy saved: ${outputPath}`);

  } else if (dashboardWriteMode === 'overwrite') {
    const ts         = createdAt.replace(/[:.]/g, '-');
    const origName   = path.basename(dashboardFilePath, '.html');
    const backupName = `${origName}.backup-${ts}.html`;
    const backupPath = path.join(path.dirname(dashboardFilePath), backupName);
    await fs.writeFile(backupPath, originalHtml, 'utf8');
    await fs.writeFile(dashboardFilePath, updatedHtml, 'utf8');
    run.dashboardUpdated    = true;
    run.dashboardBackupPath = backupPath;
    console.log(`[agent3] original backed up: ${backupPath}`);
    console.log(`[agent3] original overwritten: ${dashboardFilePath}`);
  }

  return saveRun(run);
}
