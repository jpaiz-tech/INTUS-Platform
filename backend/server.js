import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { researchRouter } from './routes/research.js';
import { promptsRouter } from './routes/prompts.js';
import { manualRouter } from './routes/manual.js';
import { agent2Router } from './routes/agent2.js';
import { agent3Router } from './routes/agent3.js';
import { dashboardOutputsRouter } from './routes/dashboardOutputs.js';
import { sectorsRouter } from './routes/sectors.js';
import { runsRouter } from './routes/runs.js';
import { dashboardHtmlRouter } from './routes/dashboardHtml.js';
import { analyticsRouter } from './routes/analytics.js';
import { reportRouter } from './routes/report.js';
import { marketDataRouter } from './routes/marketData.js';
import { requireAuth } from './middleware/requireAuth.js';

import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // 50mb — valuation PDFs can be 20MB+ as base64
// Optional Supabase-token auth (REQUIRE_AUTH=true) — see middleware/requireAuth.js
app.use('/api', requireAuth);
app.use('/dashboard-outputs', requireAuth);
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Supabase diagnostic — tests connection and table access
app.get('/api/debug/supabase', async (req, res) => {
  const supabase = (await import('./utils/supabaseClient.js')).default;
  if (!supabase) return res.json({ connected: false, reason: 'SUPABASE_URL or SUPABASE_SERVICE_KEY not set' });

  const results = {};
  for (const table of ['sectors', 'research_runs', 'industries', 'formats', 'risks', 'recommendations']) {
    try {
      const { error, count } = await supabase.from(table).select('*', { count: 'exact', head: true });
      results[table] = error ? `ERROR: ${error.message}` : `OK (${count} rows)`;
    } catch (e) {
      results[table] = `EXCEPTION: ${e.message}`;
    }
  }
  res.json({ connected: true, tables: results });
});

// Status endpoint — called by frontend on page load
app.get('/api/status', (req, res) => {
  const useClaudeApi = process.env.USE_CLAUDE_API === 'true';
  const mockApi      = process.env.MOCK_API === 'true';
  const mode         = (useClaudeApi && !mockApi) ? 'claude-api' : 'mock-api';

  res.json({
    mode,
    useClaudeApi,
    mockApi,
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    webSearchEnabled: process.env.ENABLE_WEB_SEARCH === 'true',
  });
});

app.use('/api', researchRouter);
app.use('/api', agent2Router);
app.use('/api', agent3Router);
app.use('/api/prompts', promptsRouter);
app.use('/api/runs/manual', manualRouter);
app.use('/dashboard-outputs', dashboardOutputsRouter);
app.use('/api/sectors', sectorsRouter);
app.use('/api/runs', runsRouter);
app.use('/api/dashboard-html', dashboardHtmlRouter);
app.use('/api', analyticsRouter);
app.use('/api/report', reportRouter);
app.use('/api/market-data', marketDataRouter);

// TODO: Add /api/qa route (Agent 2 — evidence validation)
// TODO: Add /api/score route (Agent 3 — sector scoring)
// TODO: Add /api/dashboard-patch route (human-approved dashboard data patching)

function resolveMode() {
  if (process.env.MOCK_API === 'true') return 'mock-api (MOCK_API=true)';
  if (process.env.USE_CLAUDE_API === 'true') return 'claude-api (USE_CLAUDE_API=true)';
  return 'mock-api (USE_CLAUDE_API not set)';
}

app.listen(PORT, () => {
  console.log(`ETRA backend running on http://localhost:${PORT}`);
  console.log(`Mode: ${resolveMode()}`);
  if (process.env.USE_CLAUDE_API === 'true' && process.env.MOCK_API !== 'true') {
    const keySet = !!process.env.ANTHROPIC_API_KEY;
    console.log(`API key: ${keySet ? 'set' : 'MISSING — add ANTHROPIC_API_KEY to .env'}`);
    console.log(`Model:   ${process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6 (fallback)'}`);
  }
});
