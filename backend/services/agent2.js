import Anthropic from '@anthropic-ai/sdk';
import nodeFetch from 'node-fetch';
import https from 'https';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const RUNS_DIR    = path.resolve(__dirname, '../data/runs');
const PROMPTS_DIR = path.resolve(__dirname, '../prompts');

const USE_CLAUDE_API          = process.env.USE_CLAUDE_API === 'true';
const MODEL                   = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const MAX_TOKENS              = parseInt(process.env.AGENT2_MAX_OUTPUT_TOKENS || '4500', 10);
const ENABLE_WEB_SEARCH       = process.env.ENABLE_WEB_SEARCH === 'true';
const WEB_SEARCH_MAX_USES     = parseInt(process.env.AGENT2_WEB_SEARCH_MAX_USES || '3', 10);

const httpsAgent = new https.Agent({ keepAlive: false });

function makeFetch(url, options = {}) {
  return nodeFetch(url, { ...options, agent: httpsAgent });
}

const RETRYABLE = ['premature close', 'econnreset', 'econnrefused', 'socket hang up', 'network error', 'fetch failed'];
function isRetryable(err) {
  const msg = (err?.message || '').toLowerCase();
  return RETRYABLE.some((s) => msg.includes(s));
}

async function saveRun(run) {
  await fs.mkdir(RUNS_DIR, { recursive: true });
  await fs.writeFile(path.join(RUNS_DIR, `${run.id}.json`), JSON.stringify(run, null, 2), 'utf8');
  return run;
}

export async function runAgent2(parentRunId) {
  const id        = uuidv4();
  const createdAt = new Date().toISOString();
  const mode      = 'claude-api';

  // Load and validate the parent Agent 1 run
  let parentRun;
  try {
    const raw = await fs.readFile(path.join(RUNS_DIR, `${parentRunId}.json`), 'utf8');
    parentRun = JSON.parse(raw);
  } catch {
    return {
      error: `Agent 1 run not found: ${parentRunId}`,
      status: 400,
    };
  }

  if (parentRun.agent !== 'agent1') {
    return { error: `Run ${parentRunId} is not an Agent 1 run.`, status: 400 };
  }
  if (!['completed', 'truncated'].includes(parentRun.status)) {
    return { error: `Agent 1 run ${parentRunId} has status "${parentRun.status}". Must be completed or truncated.`, status: 400 };
  }
  if (!parentRun.rawOutput || parentRun.rawOutput.trim() === '') {
    return { error: `Agent 1 run ${parentRunId} has no output to review.`, status: 400 };
  }

  const baseRun = {
    id,
    industry:         parentRun.industry,
    realEstateType:   parentRun.realEstateType   || '',
    company:          parentRun.company          || '',
    researchMode:     parentRun.researchMode     || 'industry',
    dashboardOverlap: parentRun.dashboardOverlap || null,
    status:           'pending',
    createdAt,
    updatedAt:        createdAt,
    agent:            'agent2',
    parentRunId,
    model:            MODEL,
    mode,
    webSearchEnabled: ENABLE_WEB_SEARCH,
    webSearchMaxUses: WEB_SEARCH_MAX_USES,
    maxOutputTokens:  MAX_TOKENS,
    rawOutput:        '',
    usage:            null,
    truncated:        false,
    error:            null,
  };

  if (!USE_CLAUDE_API) {
    return saveRun({
      ...baseRun,
      status: 'failed',
      updatedAt: new Date().toISOString(),
      error: 'USE_CLAUDE_API is not true. Set USE_CLAUDE_API=true in .env.',
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return saveRun({
      ...baseRun,
      status: 'failed',
      updatedAt: new Date().toISOString(),
      error: 'ANTHROPIC_API_KEY is not set. Add it to .env.',
    });
  }

  let systemPrompt;
  try {
    systemPrompt = (await fs.readFile(path.join(PROMPTS_DIR, 'agent2.txt'), 'utf8')).trim();
  } catch (err) {
    return saveRun({
      ...baseRun,
      status: 'failed',
      updatedAt: new Date().toISOString(),
      error: `Could not read agent2.txt: ${err.message}`,
    });
  }
  if (!systemPrompt) {
    return saveRun({ ...baseRun, status: 'failed', updatedAt: new Date().toISOString(),
      error: 'agent2.txt is empty — cannot run with a blank system prompt.' });
  }

  const scopeLines = [];
  if (parentRun.industry)      scopeLines.push(`Industry: ${parentRun.industry}`);
  if (parentRun.realEstateType) scopeLines.push(`Real Estate Type: ${parentRun.realEstateType}`);
  if (parentRun.company)        scopeLines.push(`Reference Company: ${parentRun.company}`);
  scopeLines.push(`Parent Agent 1 Run ID: ${parentRunId}`);
  if (parentRun.dashboardOverlap?.possibleOverlap) {
    scopeLines.push(`Dashboard overlap warning: ${parentRun.dashboardOverlap.warning}`);
  }

  const userMessage =
    scopeLines.join('\n') +
    `\n\nBelow is the full Agent 1 report to stress test:\n\n` +
    parentRun.rawOutput;

  console.log(`[agent2] calling Claude API`);
  console.log(`[agent2]   model:            ${MODEL}`);
  console.log(`[agent2]   max_tokens:       ${MAX_TOKENS}`);
  console.log(`[agent2]   industry:         ${parentRun.industry}`);
  console.log(`[agent2]   parentRunId:      ${parentRunId}`);
  console.log(`[agent2]   webSearchEnabled: ${ENABLE_WEB_SEARCH}`);
  if (ENABLE_WEB_SEARCH) console.log(`[agent2]   webSearchMaxUses: ${WEB_SEARCH_MAX_USES}`);

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
      if (attempt > 1) console.log(`[agent2] retry attempt ${attempt} after: ${lastError.message}`);

      const createParams = {
        model:      MODEL,
        max_tokens: MAX_TOKENS,
        system:     [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages:   [{ role: 'user', content: userMessage }],
      };
      if (ENABLE_WEB_SEARCH) {
        createParams.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: WEB_SEARCH_MAX_USES }];
      }

      const message = await client.messages.create(createParams);

      const rawOutput   = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
      const isTruncated = message.stop_reason === 'max_tokens';

      console.log(`[agent2] success — input: ${message.usage.input_tokens}, output: ${message.usage.output_tokens}, stop: ${message.stop_reason}`);
      if (isTruncated) console.warn(`[agent2] WARNING: output truncated — increase AGENT2_MAX_OUTPUT_TOKENS`);

      return saveRun({
        ...baseRun,
        status:    isTruncated ? 'truncated' : 'completed',
        truncated: isTruncated,
        updatedAt: new Date().toISOString(),
        rawOutput,
        usage: {
          input_tokens:  message.usage.input_tokens,
          output_tokens: message.usage.output_tokens,
        },
      });
    } catch (err) {
      lastError = err;
      console.error(`[agent2] attempt ${attempt} failed: ${err.message}`);
      if (attempt === 1 && isRetryable(err)) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      break;
    }
  }

  return saveRun({
    ...baseRun,
    status:    'failed',
    updatedAt: new Date().toISOString(),
    error:     lastError?.message || 'Unknown error',
  });
}
