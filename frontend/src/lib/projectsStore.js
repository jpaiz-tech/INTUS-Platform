import { supabase } from './supabase.js';
import { SK } from '../legacy/core.js';

// Persistence for Prefactibilidad projects.
// - With Supabase configured: table `platform_projects` is the source of truth
//   (shared across the team); localStorage keeps a same-browser cache.
// - Without Supabase ("modo local"): localStorage only, same key the legacy
//   HTML app used.
// Shape kept identical to the legacy app: [{ id, inputs, at }]

const rowToProject = (r) => ({ id: r.id, inputs: r.inputs, at: r.at });

export async function loadProjects() {
  if (supabase) {
    const { data, error } = await supabase
      .from('platform_projects')
      .select('id, inputs, at')
      .order('at', { ascending: true });
    if (error) throw new Error(`Supabase: ${error.message}`);
    const pjs = (data || []).map(rowToProject);
    try { localStorage.setItem(SK, JSON.stringify(pjs)); } catch { /* cache only */ }
    return pjs;
  }
  try {
    const raw = localStorage.getItem(SK);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Saves the full project list (legacy semantics: the app always passes the
// complete array). Upserts every current row and deletes rows that were
// removed. `prev` is the previously-loaded list, used to detect deletions.
export async function saveProjects(pjs, prev = []) {
  try { localStorage.setItem(SK, JSON.stringify(pjs)); } catch { /* quota */ }
  if (!supabase) return { ok: true, local: true };

  const rows = pjs.map((p) => ({
    id: String(p.id),
    inputs: p.inputs,
    name: p.inputs?.nombre || null,
    location: p.inputs?.ubicacion || null,
    at: p.at,
  }));
  const currentIds = new Set(rows.map((r) => r.id));
  const removed = prev.map((p) => String(p.id)).filter((id) => !currentIds.has(id));

  if (rows.length) {
    const { error } = await supabase.from('platform_projects').upsert(rows);
    if (error) throw new Error(`Supabase upsert: ${error.message}`);
  }
  if (removed.length) {
    const { error } = await supabase.from('platform_projects').delete().in('id', removed);
    if (error) throw new Error(`Supabase delete: ${error.message}`);
  }
  return { ok: true, local: false };
}
