import express from 'express';
import supabase from '../utils/supabaseClient.js';
import { runAgent1 } from '../services/agent1.js';

export const researchRouter = express.Router();

researchRouter.post('/research', async (req, res) => {
  const { industry = '', realEstateType = '', company = '' } = req.body;

  const industryT      = typeof industry      === 'string' ? industry.trim()      : '';
  const realEstateTypeT = typeof realEstateType === 'string' ? realEstateType.trim() : '';
  const companyT       = typeof company       === 'string' ? company.trim()       : '';

  if (!industryT && !companyT) {
    return res.status(400).json({
      error: 'At least one of "industry" or "company" is required.',
    });
  }

  // ── Duplicate / add-on check via Supabase ─────────────────────────────────
  let researchModeOverride  = null;
  let isExistingSectorAddon  = false;
  let matchedSectorName      = null;

  if (industryT && supabase) {
    try {
      const { data: existing } = await supabase
        .from('industries')
        .select('name, assets')
        .ilike('name', industryT)
        .maybeSingle();

      if (existing) {
        const hasType    = !!realEstateTypeT;
        const hasCompany = !!companyT;

        researchModeOverride  = (hasType && hasCompany) ? 'existing_sector_company_type'
                               : hasType                ? 'existing_sector_new_type'
                               :                         'existing_sector_company';
        isExistingSectorAddon  = true;
        matchedSectorName      = existing.name;
      }
    } catch {
      // Non-fatal — if Supabase unavailable proceed without blocking
    }
  }

  // ── Run Agent 1 ───────────────────────────────────────────────────────────
  const run = await runAgent1({
    industry:             industryT,
    realEstateType:        realEstateTypeT,
    company:              companyT,
    researchModeOverride,
    isExistingSectorAddon,
    matchedSectorName,
  });

  if (run.status === 'failed') {
    return res.status(500).json({ error: run.error, run });
  }

  return res.json({ run });
});
