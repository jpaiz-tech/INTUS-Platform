import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import { generateReportHTML } from '../services/reportTemplate.js';

export const reportRouter = Router();

// GET /api/report/:sectorName
// Returns a standalone HTML report for the named sector.
reportRouter.get('/:sectorName', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  const name = decodeURIComponent(req.params.sectorName);

  try {
    const { data, error } = await supabase
      .from('sectors')
      .select('sector_data')
      .eq('name', name)
      .single();

    if (error || !data?.sector_data) {
      return res.status(404).json({ error: `Sector "${name}" not found` });
    }

    const sectorData     = data.sector_data;
    const reportSections = sectorData.reportSections || null;

    const html = generateReportHTML(sectorData, reportSections);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
