import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { runAgent3 } from '../services/agent3.js';
import { runAgent4 } from '../services/agent4.js';
import supabase from '../utils/supabaseClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNS_DIR  = path.resolve(__dirname, '../data/runs');

export const agent3Router = express.Router();

agent3Router.post('/agent3', async (req, res) => {
  const {
    agent1RunId,
    agent2RunId,
    agent1RunData      = null,
    agent2RunData      = null,
    updateDashboard    = true,
    dashboardWriteMode = 'copy',
    overwriteExisting  = false,
  } = req.body;

  if (!agent1RunId || typeof agent1RunId !== 'string' || !agent1RunId.trim()) {
    return res.status(400).json({ error: 'agent1RunId is required.' });
  }
  if (!agent2RunId || typeof agent2RunId !== 'string' || !agent2RunId.trim()) {
    return res.status(400).json({ error: 'agent2RunId is required.' });
  }

  const result = await runAgent3({
    agent1RunId:       agent1RunId.trim(),
    agent2RunId:       agent2RunId.trim(),
    agent1RunData,
    agent2RunData,
    updateDashboard,
    dashboardWriteMode,
    overwriteExisting,
  });

  // Validation errors (run not saved) return { error, status }
  if (result.status === 400 && !result.id) {
    return res.status(400).json({ error: result.error });
  }

  if (result.status === 'failed') {
    return res.status(500).json({ error: result.error, run: result });
  }

  // ── Agent 4 — runs after agent3 succeeds; failure never breaks the pipeline ──
  if (result.status === 'completed' && result.sectorObject) {
    try {
      let agent1Summary = agent1RunData?.rawOutput?.substring(0, 3000) || '';
      if (!agent1Summary) {
        try {
          const run1Raw = await fs.readFile(path.join(RUNS_DIR, `${agent1RunId.trim()}.json`), 'utf8');
          agent1Summary = JSON.parse(run1Raw).rawOutput?.substring(0, 3000) || '';
        } catch (_) {}
      }

      const agent4Result = await runAgent4({
        industry:     result.industry || result.sectorObject.name,
        agent1Summary,
        agent3Output: result,
      });

      if (agent4Result?.sections) {
        // Embed reportSections in sectorObject so the frontend download picks it up automatically
        result.sectorObject.reportSections = agent4Result.sections;
        // Re-save run file with reportSections embedded
        await fs.writeFile(
          path.join(RUNS_DIR, `${result.id}.json`),
          JSON.stringify(result, null, 2),
          'utf8'
        );
        // Update Supabase sectors table so /api/report/:sectorName gets Agent 4 prose
        if (supabase) {
          try {
            await supabase.from('sectors').upsert({
              name:        result.sectorObject.name,
              sector_data: result.sectorObject,
              updated_at:  new Date().toISOString(),
            }, { onConflict: 'name' });
          } catch (err) {
            console.error('[Agent 4] Failed to update sectors in Supabase:', err.message);
          }
        }
      }
    } catch (err) {
      console.error('[Agent 4] Failed — report will use fallback template:', err.message);
      // sectorObject already saved to Supabase and disk by agent3; pipeline continues
    }
  }

  return res.json({ run: result });
});
