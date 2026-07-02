import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';
import { recalculateSector } from '../services/sectorUtils.js';

export const sectorsRouter = Router();

sectorsRouter.get('/', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  const { data, error } = await supabase
    .from('sectors')
    .select('*')
    .eq('active', true)
    .order('score_exact', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  if (req.query.include_formats !== 'true') return res.json(data);

  // Join sector_formats rows into each sector
  const names = data.map(r => r.name);
  const { data: formats, error: fmtErr } = await supabase
    .from('sector_formats')
    .select('*')
    .in('sector_name', names)
    .order('score', { ascending: false });

  if (fmtErr) return res.status(500).json({ error: fmtErr.message });

  const fmtMap = {};
  for (const f of (formats || [])) {
    if (!fmtMap[f.sector_name]) fmtMap[f.sector_name] = [];
    fmtMap[f.sector_name].push(f);
  }

  res.json(data.map(row => ({ ...row, formats: fmtMap[row.name] || [] })));
});

sectorsRouter.delete('/:name', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  const name = decodeURIComponent(req.params.name);

  const { error } = await supabase
    .from('sectors')
    .update({ active: false })
    .eq('name', name);

  if (error) return res.status(500).json({ error: error.message });

  res.json({ success: true });
});

sectorsRouter.delete('/:name/tabs/:tabLabel', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  const name     = decodeURIComponent(req.params.name);
  const tabLabel = decodeURIComponent(req.params.tabLabel);

  const { data, error } = await supabase
    .from('sectors')
    .select('sector_data')
    .eq('name', name)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Sector not found' });

  const sectorData  = data.sector_data;
  const tabsBefore  = sectorData.tabs?.length ?? 0;

  sectorData.tabs = (sectorData.tabs || []).filter(t => t.shortLabel !== tabLabel);

  if (sectorData.tabs.length === tabsBefore) {
    return res.status(404).json({ error: `Tab "${tabLabel}" not found in sector "${name}"` });
  }

  if (sectorData.tabs.length === 0) {
    const { error: delErr } = await supabase
      .from('sectors')
      .update({ active: false })
      .eq('name', name);
    if (delErr) return res.status(500).json({ error: delErr.message });
    return res.json({ success: true, deletedSector: true });
  }

  // Remove the deleted tab's dimScore entry (keep index 0 = Promedio)
  sectorData.dimScores = sectorData.dimScores.filter(
    (d, i) => i === 0 || d.label !== tabLabel
  );

  const updated = recalculateSector(sectorData);
  const now = new Date().toISOString();

  // Update sectors table
  const { error: upErr } = await supabase
    .from('sectors')
    .update({
      score:       updated.score,
      score_exact: updated.scoreExact,
      assets:      updated.assets,
      sector_data: updated,
      updated_at:  now,
    })
    .eq('name', name);

  if (upErr) return res.status(500).json({ error: upErr.message });

  // Delete the removed tab from normalized tables
  await supabase.from('sub_criteria').delete().eq('industry_name', name).eq('format_label', tabLabel);
  await supabase.from('dimension_scores').delete().eq('industry_name', name).eq('format_label', tabLabel);
  await supabase.from('formats').delete().eq('industry_name', name).eq('short_label', tabLabel);

  // Keep industries score in sync with the recalculated score
  await supabase.from('industries').update({
    score:       updated.score,
    score_exact: updated.scoreExact ?? updated.score,
    updated_at:  now,
  }).eq('name', name);

  res.json({ success: true, deletedSector: false, sector: updated });
});
