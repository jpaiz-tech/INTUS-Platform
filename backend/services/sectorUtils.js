const WEIGHTS = [0.27, 0.22, 0.18, 0.16, 0.17];

export function recalculateSector(sectorData) {
  const tabs = sectorData.tabs;

  tabs.forEach(tab => {
    const dimScores = (tab.dims || []).map(d => d.score);
    tab.score = Math.round(
      dimScores.reduce((sum, s, i) => sum + s * WEIGHTS[i], 0)
    );
  });

  const tabScores  = tabs.map(t => t.score);
  const rawExact   = tabScores.reduce((sum, s) => sum + s, 0) / tabScores.length;
  sectorData.scoreExact = Math.round(rawExact * 10) / 10;
  sectorData.score      = Math.round(rawExact);

  const promedio = [];
  for (let di = 0; di < 5; di++) {
    const vals = tabs.map(t => t.dims[di]?.score ?? 0);
    promedio.push(Math.round(vals.reduce((a, b) => a + b, 0) / vals.length));
  }
  if (sectorData.dimScores?.[0]) sectorData.dimScores[0].scores = promedio;

  sectorData.assetChips = tabs.map(t => ({
    label:   t.shortLabel,
    score:   t.score,
    pending: false,
  }));

  sectorData.assets = [...new Set(
    tabs.map(t => t.assets?.[0]?.label ?? null).filter(Boolean)
  )];

  return sectorData;
}

export function mergeSectors(existingData, incomingData) {
  // Match tabs by asset type (Industrial/Retail/Oficinas) first, then fall back to shortLabel.
  // This handles Claude generating different shortLabels across runs for the same format.
  const assetKey = t => (t.assets?.[0]?.label || '').toLowerCase();
  const shortKey = t => t.shortLabel.toLowerCase();

  const existingByShort = new Map(existingData.tabs.map(t => [shortKey(t), t]));
  const existingByAsset = new Map(
    existingData.tabs.filter(t => assetKey(t)).map(t => [assetKey(t), t])
  );
  const findExisting = t => existingByShort.get(shortKey(t)) || existingByAsset.get(assetKey(t));

  const incomingByShort = new Map(incomingData.tabs.map(t => [shortKey(t), t]));
  const incomingByAsset = new Map(
    incomingData.tabs.filter(t => assetKey(t)).map(t => [assetKey(t), t])
  );
  const findIncoming = t => incomingByShort.get(shortKey(t)) || incomingByAsset.get(assetKey(t));

  const newTabs = incomingData.tabs.filter(t => !findExisting(t));

  const merged = JSON.parse(JSON.stringify(existingData));

  // Replace existing tabs with their incoming counterpart (matched by asset type or shortLabel)
  merged.tabs = merged.tabs.map(t => {
    const fresh = findIncoming(t);
    return fresh ? JSON.parse(JSON.stringify(fresh)) : t;
  });

  // Append genuinely new tabs (no match in existing by either key)
  merged.tabs = [...merged.tabs, ...newTabs.map(t => JSON.parse(JSON.stringify(t)))];

  // Rebuild all per-tab dimScore entries from current tabs to stay in sync with any label changes
  const promedioDimScore = merged.dimScores?.[0] || { label: 'Promedio', scores: [] };
  merged.dimScores = [
    promedioDimScore,
    ...merged.tabs.map(t => ({
      label:  t.shortLabel,
      scores: (t.dims || []).map(d => d.score),
    })),
  ];

  const mode = newTabs.length > 0 ? 'merged' : 'replaced';
  return { merged: recalculateSector(merged), newTabs, mode };
}
