import supabase from '../utils/supabaseClient.js';

const DIM_NAMES = ['Durabilidad', 'Solidez', 'Adhesión', 'Solvencia', 'Resiliencia'];
const WEIGHTS   = [0.27, 0.22, 0.18, 0.16, 0.17];

function tier(s) {
  return s >= 85 ? 'A+' : s >= 75 ? 'A' : s >= 60 ? 'B' : s >= 45 ? 'C' : 'D';
}

/**
 * Write a fully-merged sector to all 9 normalized Supabase tables.
 * A DB failure logs and returns without crashing the pipeline.
 *
 * @param {object} sectorObject  - Fully merged sector (all tabs, old + new)
 * @param {string} runId         - Agent3 run UUID (null for migrations)
 * @param {object} inputs        - { industry, company, realEstateType, researchMode }
 * @param {object} opts          - { skipRunRecord: false } — set true for migrations
 */
export async function writeSectorToDatabase(sectorObject, runId, inputs = {}, opts = {}) {
  if (!supabase) return;
  const { skipRunRecord = false } = opts;
  const now = new Date().toISOString();

  try {
    // ── 0. research_runs — write FIRST so the run is always recorded ─────────
    if (!skipRunRecord && runId) {
      const { error: runErr } = await supabase.from('research_runs').insert({
        run_id:           runId,
        industry_name:    sectorObject.name,
        industry_input:   inputs.industry || sectorObject.name,
        company_input:    inputs.company  || null,
        real_estate_type: inputs.realEstateType || null,
        research_mode:    inputs.researchMode   || null,
        agent:            'agent3',
        status:           'completed',
        output_summary:   `Score: ${sectorObject.score} · Tier ${tier(sectorObject.score)} · Formats: ${(sectorObject.tabs || []).map(t => t.shortLabel).join(', ')} · Prior research: ${inputs.hasPriorResearch ? 'yes' : 'first run'}`,
      });
      if (runErr) console.error(`[sectorDb] research_runs insert failed: ${runErr.message}`);
    }

    // ── 1. sectors (dashboard reads sector_data from here) ──────────────────
    const { error: secErr } = await supabase.from('sectors').upsert({
      name:        sectorObject.name,
      score:       sectorObject.score,
      score_exact: sectorObject.scoreExact ?? sectorObject.score,
      assets:      sectorObject.assets ?? [],
      sub:         sectorObject.sub ?? '',
      sector_data: sectorObject,
      updated_at:  now,
    }, { onConflict: 'name' });
    if (secErr) throw new Error(`sectors: ${secErr.message}`);

    // ── 2. industries (normalized mirror of sectors) ─────────────────────────
    const { data: industryRow, error: indErr } = await supabase.from('industries').upsert({
      name:        sectorObject.name,
      sub:         sectorObject.sub ?? '',
      score:       sectorObject.score,
      score_exact: sectorObject.scoreExact ?? sectorObject.score,
      tier:        tier(sectorObject.score),
      assets:      sectorObject.assets ?? [],
      updated_at:  now,
    }, { onConflict: 'name' }).select('id').maybeSingle();
    if (indErr) throw new Error(`industries: ${indErr.message}`);

    const industryId = industryRow?.id ?? null;

    // ── 3–5. formats → dimension_scores → sub_criteria ──────────────────────
    for (const tab of (sectorObject.tabs || [])) {
      const assetLabel = tab.assets?.[0]?.label || tab.assets?.[0] || '';

      const { data: formatRow, error: fmtErr } = await supabase.from('formats').upsert({
        industry_id:   industryId,
        industry_name: sectorObject.name,
        short_label:   tab.shortLabel,
        tab_label:     tab.label ?? tab.shortLabel,
        asset_type:    String(assetLabel),
        score:         tab.score,
        score_exact:   tab.score,
        tier:          tier(tab.score),
        updated_at:    now,
      }, { onConflict: 'industry_name,short_label' }).select('id').maybeSingle();
      if (fmtErr) throw new Error(`formats (${tab.shortLabel}): ${fmtErr.message}`);

      const formatId = formatRow?.id ?? null;

      for (let di = 0; di < 5; di++) {
        const dim = tab.dims?.[di];
        if (!dim) continue;

        // 4. dimension_scores
        const { error: dimErr } = await supabase.from('dimension_scores').upsert({
          format_id:    formatId,
          industry_name: sectorObject.name,
          format_label: tab.shortLabel,
          dimension:    DIM_NAMES[di],
          weight:       WEIGHTS[di],
          score:        dim.score,
          contribution: parseFloat((dim.score * WEIGHTS[di]).toFixed(2)),
        }, { onConflict: 'format_id,dimension' });
        if (dimErr) throw new Error(`dimension_scores (${tab.shortLabel}/${DIM_NAMES[di]}): ${dimErr.message}`);

        // 5. sub_criteria
        for (const sub of (dim.subs || [])) {
          const { error: subErr } = await supabase.from('sub_criteria').upsert({
            format_id:         formatId,
            industry_name:     sectorObject.name,
            format_label:      tab.shortLabel,
            dimension:         DIM_NAMES[di],
            sub_name:          sub.n,
            score:             sub.s ?? null,
            tag:               sub.tag || null,
            note:              sub.note || null,
            space_criticality: sub.spaceCriticality?.label || null,
          }, { onConflict: 'format_id,dimension,sub_name' });
          if (subErr) throw new Error(`sub_criteria (${tab.shortLabel}/${DIM_NAMES[di]}/${sub.n}): ${subErr.message}`);
        }
      }
    }

    // ── 6. recommendations ───────────────────────────────────────────────────
    const reco = sectorObject.reco || {};
    const { error: recoErr } = await supabase.from('recommendations').upsert({
      industry_id:   industryId,
      industry_name: sectorObject.name,
      text:          reco.text   || null,
      verdict:       reco.verdict || null,
      capex_note:    reco.capexNote || null,
      updated_at:    now,
    }, { onConflict: 'industry_name' });
    if (recoErr) throw new Error(`recommendations: ${recoErr.message}`);

    // ── 7. risks (delete-then-insert to keep fresh) ──────────────────────────
    await supabase.from('risks').delete().eq('industry_name', sectorObject.name);
    for (const risk of (reco.risks || [])) {
      const { error: riskErr } = await supabase.from('risks').insert({
        industry_id:   industryId,
        industry_name: sectorObject.name,
        risk:          risk.risk    || null,
        type:          risk.type    || null,
        prob:          risk.prob    || null,
        impact:        risk.impact  || null,
        horizon:       risk.horizon || null,
      });
      if (riskErr) throw new Error(`risks: ${riskErr.message}`);
    }

    // ── 8. reference company ─────────────────────────────────────────────────
    if (inputs.company) {
      const { error: coErr } = await supabase.from('companies').upsert({
        name:          inputs.company,
        industry_name: sectorObject.name,
        role:          'reference',
        source_run_id: runId || null,
      }, { onConflict: 'name,industry_name' });
      if (coErr) throw new Error(`companies: ${coErr.message}`);
    }

    console.log(`✓ Sector written to all tables: ${sectorObject.name}`);
  } catch (err) {
    console.error(`✗ writeSectorToDatabase failed for "${sectorObject.name}": ${err.message}`);
    throw err;
  }
}
