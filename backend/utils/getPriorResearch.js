import supabase from './supabaseClient.js';

/**
 * Fetch prior sub_criteria from Supabase for a given industry name
 * and return a formatted context block to prepend to the Agent 1 user message.
 * Returns null if no prior research exists or if the query fails.
 */
export async function getPriorResearch(industryName) {
  if (!supabase || !industryName) return null;

  const { data: existing, error } = await supabase
    .from('sub_criteria')
    .select(`
      format_label,
      dimension,
      sub_name,
      score,
      tag,
      note,
      space_criticality,
      formats ( asset_type )
    `)
    .eq('industry_name', industryName)
    .order('format_label')
    .order('dimension')
    .order('sub_name');

  if (error || !existing || existing.length === 0) return null;

  // Group by format
  const byFormat = {};
  for (const row of existing) {
    if (!byFormat[row.format_label]) {
      byFormat[row.format_label] = { assetType: row.formats?.asset_type || '', subs: [] };
    }
    byFormat[row.format_label].subs.push(row);
  }

  // Evidence quality summary per format
  const summary = Object.entries(byFormat).map(([label, data]) => {
    const v = data.subs.filter(s => s.tag === 'VERIFIED').length;
    const p = data.subs.filter(s => s.tag === 'PROXY').length;
    const e = data.subs.filter(s => s.tag === 'ESTIMATED').length;
    return `  ${label} (${data.assetType}): ${v} VERIFIED · ${p} PROXY · ${e} ESTIMATED`;
  }).join('\n');

  // ESTIMATED subs — priority research targets
  const estimatedRows = existing.filter(s => s.tag === 'ESTIMATED');
  const estimated = estimatedRows
    .map(s => `  - [${s.format_label}] ${s.dimension} · ${s.sub_name}\n    Note: "${(s.note || '').substring(0, 100)}"`)
    .join('\n');

  // VERIFIED/PROXY subs — confirmed baseline
  const confirmedRows = existing.filter(s => ['VERIFIED', 'PROXY'].includes(s.tag));
  const confirmed = confirmedRows
    .slice(0, 25)
    .map(s => `  - [${s.format_label}] ${s.dimension} · ${s.sub_name} [${s.tag}]\n    Note: "${(s.note || '').substring(0, 100)}"`)
    .join('\n');
  const confirmedTotal = confirmedRows.length;

  return `=== PRIOR RESEARCH CONTEXT ===
Industry: ${industryName}
Formats previously researched: ${Object.keys(byFormat).join(', ')}
Total sub-criteria on record: ${existing.length}

Evidence quality by format:
${summary}

PRIORITY — ESTIMATED subs (research these specifically to upgrade evidence):
${estimated || '  None — all subs have PROXY or VERIFIED evidence'}

CONFIRMED — VERIFIED/PROXY subs (accept as baseline unless contradicted):
${confirmed}${confirmedTotal > 25 ? `\n  ... and ${confirmedTotal - 25} more confirmed subs` : ''}
=== END PRIOR RESEARCH CONTEXT ===`;
}
