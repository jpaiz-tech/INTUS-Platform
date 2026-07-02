import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import supabase from '../utils/supabaseClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const runsRouter = express.Router();

const RUNS_DIR = process.env.RUNS_DIR
  || path.resolve(__dirname, '../data/runs');

// GET /api/runs — list from research_runs table; fall back to sectors then JSON files
runsRouter.get('/', async (req, res) => {
  if (supabase) {
    const tierLabel = s => s >= 85 ? 'A+' : s >= 75 ? 'A' : s >= 60 ? 'B' : s >= 45 ? 'C' : 'D';

    // Try research_runs — tolerate query failure (e.g. schema mismatch)
    let rows = null;
    try {
      const { data, error } = await supabase
        .from('research_runs')
        .select('run_id, industry_name, industry_input, company_input, real_estate_type, research_mode, agent, status, output_summary, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) console.error('[runs] research_runs query error:', error.message);
      else rows = data || [];
    } catch (err) {
      console.error('[runs] research_runs query threw:', err.message);
    }

    // If research_runs empty or failed, synthesize from sectors table
    if (!rows || rows.length === 0) {
      try {
        const { data: secs, error: secErr } = await supabase
          .from('sectors')
          .select('name, score, sub, updated_at')
          .order('updated_at', { ascending: false });
        if (secErr) console.error('[runs] sectors fallback error:', secErr.message);
        else if (secs && secs.length > 0) {
          return res.json(secs.map(s => ({
            id:             `sector-${s.name}`,
            agent:          'agent3',
            industry:       s.name,
            realEstateType: '',
            company:        '',
            status:         'completed',
            mode:           null,
            model:          null,
            createdAt:      s.updated_at,
            finalScore:     s.score,
            tier:           s.score != null ? tierLabel(s.score) : null,
            sectorName:     s.name,
          })));
        }
      } catch (err) {
        console.error('[runs] sectors fallback threw:', err.message);
      }
      // Nothing in Supabase at all — fall through to JSON files below
    } else {
      // research_runs has data — enrich with scores from sectors
      function parseScore(summary) {
        const m = /Score:\s*(\d+)/.exec(summary || '');
        return m ? parseInt(m[1], 10) : null;
      }
      const names = [...new Set(rows.map(r => r.industry_name).filter(Boolean))];
      let scoreMap = {};
      if (names.length) {
        try {
          const { data: secs } = await supabase.from('sectors').select('name, score').in('name', names);
          for (const s of (secs || [])) scoreMap[s.name] = s.score;
        } catch (_) {}
      }
      return res.json(rows.map(r => {
        const score = scoreMap[r.industry_name] ?? parseScore(r.output_summary);
        return {
          id:             r.run_id,
          agent:          r.agent,
          industry:       r.industry_input || r.industry_name,
          realEstateType: r.real_estate_type || '',
          company:        r.company_input   || '',
          status:         r.status,
          mode:           null,
          model:          null,
          createdAt:      r.created_at,
          finalScore:     score,
          tier:           score != null ? tierLabel(score) : null,
          sectorName:     r.industry_name,
        };
      }));
    }
  }

  // Fallback — scan data/runs/ JSON files
  try {
    let files;
    try {
      files = await fs.readdir(RUNS_DIR);
    } catch {
      return res.json([]);
    }

    const runs = await Promise.all(
      files.filter(f => f.endsWith('.json')).map(async f => {
        try {
          const run = JSON.parse(await fs.readFile(path.join(RUNS_DIR, f), 'utf8'));
          return {
            id:             run.id,
            agent:          run.agent,
            industry:       run.industry,
            realEstateType: run.realEstateType || '',
            company:        run.company || '',
            status:         run.status,
            mode:           run.mode,
            model:          run.model,
            createdAt:      run.createdAt,
            finalScore:     run.parsedOutput?.finalScore ?? null,
            tier:           run.parsedOutput?.tier       ?? null,
            sectorName:     run.sectorObject?.name       ?? null,
          };
        } catch { return null; }
      })
    );

    res.json(runs.filter(Boolean).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/runs/:id — fetch from Supabase (research_runs + sectors); fall back to JSON file
runsRouter.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!/^[a-f0-9-]{36}$/.test(id)) return res.status(400).json({ error: 'Invalid run id' });

  if (supabase) {
    try {
      const { data: run } = await supabase
        .from('research_runs')
        .select('run_id, industry_name, industry_input, company_input, real_estate_type, research_mode, agent, status, output_summary, created_at')
        .eq('run_id', id)
        .maybeSingle();

      if (run) {
        // Fetch full sector object from sectors table
        let sectorObject = null;
        if (run.industry_name) {
          const { data: sec } = await supabase
            .from('sectors')
            .select('sector_data')
            .eq('name', run.industry_name)
            .maybeSingle();
          sectorObject = sec?.sector_data ?? null;
        }

        return res.json({
          id:             run.run_id,
          agent:          run.agent,
          industry:       run.industry_input || run.industry_name,
          realEstateType: run.real_estate_type || '',
          company:        run.company_input   || '',
          status:         run.status,
          createdAt:      run.created_at,
          sectorObject,
        });
      }
    } catch {
      // fall through to JSON file
    }
  }

  // Fallback — read JSON file directly
  try {
    const raw = await fs.readFile(path.join(RUNS_DIR, `${id}.json`), 'utf8');
    res.json(JSON.parse(raw));
  } catch {
    res.status(404).json({ error: 'Run not found' });
  }
});
