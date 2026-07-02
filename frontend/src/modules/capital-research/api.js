const BASE = import.meta.env.VITE_API_BASE || '';

export async function fetchSectors() {
  const res = await fetch(`${BASE}/api/sectors`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const rows = await res.json();
  return rows
    .map(row => row.sector_data)
    .filter(Boolean)
    .sort((a, b) => (b.scoreExact ?? b.score) - (a.scoreExact ?? a.score));
}
