import { Router } from 'express';
import supabase from '../utils/supabaseClient.js';

export const analyticsRouter = Router();

// GET /api/dimension-scores
// Query params: ?sector=name, ?dimension=Solvencia, ?min_score=70
analyticsRouter.get('/dimension-scores', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
  try {
    let query = supabase.from('dimension_scores').select('*');
    if (req.query.sector)    query = query.eq('sector_name', req.query.sector);
    if (req.query.dimension) query = query.eq('dimension', req.query.dimension);
    if (req.query.min_score) query = query.gte('score', parseInt(req.query.min_score, 10));
    query = query.order('sector_name').order('dimension');
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sector-formats
// Query params: ?asset_type=Industrial, ?min_score=70
analyticsRouter.get('/sector-formats', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
  try {
    let query = supabase.from('sector_formats').select('*');
    if (req.query.asset_type) query = query.eq('asset_type', req.query.asset_type);
    if (req.query.min_score)  query = query.gte('score', parseInt(req.query.min_score, 10));
    query = query.order('score', { ascending: false });
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/runs-history
// Query params: ?sector=name, ?agent=agent3, ?limit=50 (default 50, max 200)
analyticsRouter.get('/runs-history', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    let query = supabase.from('research_runs').select('*');
    if (req.query.sector) query = query.eq('sector_name', req.query.sector);
    if (req.query.agent)  query = query.eq('agent', req.query.agent);
    query = query.order('created_at', { ascending: false }).limit(limit);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/companies
// Query params: ?sector=name
analyticsRouter.get('/companies', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
  try {
    let query = supabase.from('companies').select('*');
    if (req.query.sector) query = query.eq('sector_name', req.query.sector);
    query = query.order('name');
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
