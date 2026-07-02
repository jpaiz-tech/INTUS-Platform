import Anthropic from '@anthropic-ai/sdk';

const MODEL       = process.env.ANTHROPIC_MODEL       || 'claude-sonnet-4-6';
const MODEL_CHEAP = process.env.ANTHROPIC_MODEL_CHEAP || 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `You are a market intelligence analyst for Intus Capital, a real estate investment firm in Latin America. You extract and structure real estate market data for offices, retail, and industrial sectors across Central America and the Caribbean.

ANY source is valid — broker reports, investor surveys, valuation firms, government statistics, news articles, academic papers, fund manager interviews, appraisals, feasibility studies, or any other document. If it contains a number related to real estate markets (cap rates, rents, vacancy, inventory, absorption, discount rates, prices, yields, or any other metric), extract it. The source does not need to be a formal market report.

CRITICAL RULE: Only extract data explicitly stated in the content. Never infer, estimate, or fabricate values. Every number must trace to the actual text or chart in the document.

Asset classes: Industrial, Oficinas (Office), Retail
Countries covered: Panama, Costa Rica, El Salvador, Guatemala, Dominican Republic`;

function makeClient(extraHeaders = {}) {
  return new Anthropic({
    apiKey:         process.env.ANTHROPIC_API_KEY,
    timeout:        120_000,
    maxRetries:     0,
    defaultHeaders: { 'anthropic-beta': 'prompt-caching-2024-07-31', ...extraHeaders },
  });
}

// ── Step 1: Parse user query into DB filters ──────────────────────────────────
export async function parseQueryIntent(query, columnStructure = {}, history = []) {
  const client = makeClient();

  const colContext = Object.entries(columnStructure)
    .map(([tab, keys]) => `${tab}: ${keys.slice(0, 30).join(', ')}`)
    .join('\n');

  const historyContext = history.length > 0
    ? `\nConversation history (use this to resolve relative references like "that market", "add retail", "remove X"):\n${
        history.map((h, i) => `Turn ${i+1}: "${h.query}" → filters: ${JSON.stringify(h.filters_used)}, sector: ${h.filters_used?.sector || 'all'}, pais: ${h.filters_used?.pais || 'all'}`).join('\n')
      }\n`
    : '';

  const message = await client.messages.create({
    model:      MODEL_CHEAP,
    max_tokens: 600,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content: `Extract the search intent from this query into a filter object.
${historyContext}
Current query: "${query}"

Available data columns by sheet tab:
${colContext || '(no columns loaded yet)'}

Return ONLY valid JSON (no explanation):
{
  "filters": {
    "pais":    string or null,
    "ciudad":  string or null,
    "subzona": string or null,
    "sector":  "Oficinas" | "Industrial" | "Retail" | null,
    "tipo":    string or null,
    "periodo": string or null,
    "metricas": string[]
  },
  "interpreted_as": string,
  "output_type": "market_overview" | "trend_chart" | "market_ranking" | "comparison" | "coverage_audit" | "one_pager" | "due_diligence" | "red_flags" | "best_entry_markets"
}`,
    }],
  });

  console.log(`[market-data] intent parse — input: ${message.usage.input_tokens}, output: ${message.usage.output_tokens}`);

  const raw = message.content[0]?.text || '{}';
  try {
    return JSON.parse(raw.replace(/```json\n?/g, '').replace(/```/g, '').trim());
  } catch {
    return { filters: {}, interpreted_as: query, output_type: 'market_overview' };
  }
}

// ── Step 2: Fill structured response from DB rows ─────────────────────────────
const COMPLEX_TYPES = new Set(['due_diligence', 'red_flags', 'one_pager', 'best_entry_markets']);

// For simple queries strip info_resumen (big cost saver). For complex analysis keep it.
function slimRows(rows, outputType) {
  const keepNotes = COMPLEX_TYPES.has(outputType);
  return rows.slice(0, 60).map(r => {
    const { id, created_at, updated_at, sheet_tab, sheet_row, source_type, ...rest } = r;
    if (!keepNotes) delete rest.info_resumen;
    return rest;
  });
}

export async function fillQueryResponse(query, intent, rows, columnStructure = {}, history = []) {
  const client = makeClient();
  const hasData  = rows.length > 0;
  const slim     = slimRows(rows, intent.output_type);
  const historyContext = history.length > 0
    ? `\nPrevious queries in this conversation:\n${history.map(h => `- "${h.query}": ${h.summary}`).join('\n')}\n`
    : '';

  // Build a readable column list from the structure
  const allColumns = [...new Set(Object.values(columnStructure).flat())];

  const message = await client.messages.create({
    model:       MODEL,
    max_tokens:  4000,
    tools:       [RESPONSE_TOOL],
    tool_choice: { type: 'tool', name: 'market_response' },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content: `Analyze the market data below and fill the market_response tool.
${historyContext}
Current query: "${query}"
Interpreted as: "${intent.interpreted_as || query}"
Output type: ${intent.output_type || 'market_overview'}

Available columns: ${allColumns.slice(0, 40).join(', ')}

Database rows (${slim.length} of ${rows.length} total — numeric fields only, text notes stripped):
${hasData ? JSON.stringify(slim, null, 2) : 'NO ROWS FOUND'}

Instructions:
${hasData ? `- For metric_cards: use the MOST RECENT period available. Show one card per key metric, not one per source.
- For the comparison table: ONE row per subzona (use the most recent period per subzona). Do NOT list the same subzona multiple times for different sources — pick the most recent or note the range in a single cell.
- For time series data (same subzona, multiple periods), use a line chart.
- For cross-subzona comparisons (same period), use a bar chart.
- List all referencia values as sources.
- Note gaps where data is missing or inconsistent across sources.
- Write a 2-3 paragraph Spanish analytical report in report_md — synthesize trends, don't just list numbers.
- Always show: renta_prom_mes or renta_prom_m2_mes (whichever exists), disponibilidad, cap_rate if present.`
: `- CRITICAL: No data found. Set ALL metric_cards to missing: true, table to null, charts to [].
- summary must clearly state no data is available for this query.
- report_md must explain what was searched and suggest what data to load.
- DO NOT invent any numbers.`}`,
    }],
  });

  console.log(`[market-data] fill response — input: ${message.usage.input_tokens}, output: ${message.usage.output_tokens}, rows: ${rows.length}`);

  const toolUse = message.content.find(b => b.type === 'tool_use');
  if (!toolUse) throw new Error('[market-data] market_response tool not called');
  return toolUse.input;
}

// ── Step 3: Extract rows from text/PDF — guided by current sheet columns ───────
export async function extractMarketRows(content, contentType = 'pasted_text', columnStructure = {}, sheetStyle = {}) {
  const isPdf    = contentType === 'pdf';
  const headers  = isPdf
    ? { 'anthropic-beta': 'pdfs-2024-09-25,prompt-caching-2024-07-31' }
    : {};
  const client   = makeClient(headers);

  // Build extraction schema from current sheet columns
  const colsByTab = Object.entries(columnStructure)
    .map(([tab, keys]) => `${tab} tab columns: ${keys.join(', ')}`)
    .join('\n');

  const instruction = buildExtractInstruction(colsByTab, sheetStyle);

  const userContent = isPdf
    ? [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: content } },
        { type: 'text', text: instruction },
      ]
    : `${instruction}\n\nText to extract from:\n\n${content}`;

  const message = await client.messages.create({
    model:       MODEL,
    max_tokens:  16000,
    tools:       [EXTRACT_TOOL],
    tool_choice: { type: 'tool', name: 'extract_market_rows' },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userContent }],
  });

  console.log(`[market-data] extract rows — input: ${message.usage.input_tokens}, output: ${message.usage.output_tokens}, type: ${contentType}`);

  const toolUse = message.content.find(b => b.type === 'tool_use');
  if (!toolUse) throw new Error('[market-data] extract_market_rows tool not called');
  return toolUse.input;
}

function buildExtractInstruction(columnContext, sheetStyle = {}) {
  const { ciudades = [], subzonas = [], tipos = [], periodos = [], referencias = [] } = sheetStyle;

  const fmt = list => list.map(v => `"${v}"`).join(', ');
  const styleBlock = (ciudades.length || periodos.length) ? `
━━━ MATCH THE SHEET'S EXISTING VOCABULARY — DO NOT INVENT NEW SPELLINGS ━━━

These are REAL values already in the spreadsheet. When your extracted value refers to the same
thing as one of these, use the EXACT same spelling, language, and format — never an English
translation or a reordered variant.

- ciudad values in use: ${fmt(ciudades) || '(none yet)'}
  (e.g. write "Ciudad de Panamá", never "Panama City")
- subzona values in use: ${fmt(subzonas.slice(0, 20)) || '(none yet)'}
- tipo values in use: ${fmt(tipos) || '(none yet)'}
- periodo format in use: ${fmt(periodos.slice(0, 8)) || '(none yet)'}
  (year FIRST: "2026-Q1", "2022" — never "Q1-2026")
- referencia values in use — match this naming style for new documents:
${referencias.map(r => `  - "${r}"`).join('\n') || '  (none yet)'}

Only introduce a NEW ciudad/subzona/tipo value if the document genuinely covers a market that
none of the existing values describe.
` : '';

  return `Extract all real estate market data from this content into structured rows for the ETRA spreadsheet.
${styleBlock}

━━━ THE ONLY RULE THAT MATTERS FOR COLUMNS ━━━

The spreadsheet has a fixed set of columns. These are the ONLY named fields allowed in each row:

IDENTITY FIELDS (always fill what you can):
- pais: country in Spanish ("Costa Rica", "Panamá", "El Salvador", "Guatemala", "Rep. Dominicana")
- ciudad: city name in Spanish, matching the sheet vocabulary above ("Ciudad de Panamá", "San José"), or null if data is country-level
- subzona: sub-market/zone, or null if not specified
- sector: EXACTLY one of "Oficinas", "Industrial", "Retail"
- tipo: sub-type or methodology (e.g. "Transacciones", "Clase A - Encuesta GP", "Logística")
- periodo: the period this row represents, year FIRST (e.g. "2022", "2022-Q3", "2026-Q1" — never "Q3-2022")
- fecha: ALWAYS fill this, never leave it null when periodo is present.
  - Quarter periods ("2026-Q1") → use the quarter's last day (e.g. "2026-03-31").
  - Bare-year periods ("2013", "2022") → use December 31 of that year (e.g. "2013-12-31").
  - Only leave fecha null if periodo itself is completely unknown.
- referencia: the document's title EXACTLY as it appears on its cover/header — one clean string,
  copied once. Do NOT append extra invented suffixes like an additional "- 2023" after the title
  already contains a year. If genuinely unsure of the exact title, use a short accurate description
  instead of concatenating guesses. Match the style of the existing referencia values shown above.
- tendencia: market trend direction if the document states or implies one — "Positiva", "Negativa",
  "Estable", or "Mixta". This is a real named field, not a number — always include it directly here
  when available, never fold it into info_resumen and never skip it for being non-numeric.
- source_type: "pdf" or "pasted_text"

EXISTING METRIC COLUMNS (only use what exists in the sheet):
${columnContext || '(none yet — use standard fields: cap_rate, renta_prom_m2_mes, disponibilidad, inventario_total_m2, absorcion_neta, m2_construccion)'}

RULE: If a number from the document maps to one of the columns above → put it in that column.
RULE: If a number does NOT map to any existing column → put it in info_resumen. Do NOT create a new column for it.
RULE: Never add a key to a row that isn't in the lists above. No exceptions.

━━━ info_resumen — everything else goes here ━━━

Any numeric data point that doesn't fit an existing column goes into info_resumen as compact text.
Format: "Label: value | Label: value | Label: value"
HARD LIMIT: info_resumen must be under 200 characters. Key numbers only — no sentences, no commentary.
Good: "Tasa desc: 12.5% | Prima riesgo: 2% | Crecimiento renta: 3%"
Bad: "The discount rate applied was 12.5% which reflects the current market conditions..." (too long)
Skip qualitative text entirely — only extract actual numbers.

━━━ DO NOT CREATE METRIC-LESS ROWS ━━━

A row must have at least ONE existing metric column filled (cap_rate, renta_prom_m2_mes, etc.).
Data that only fits info_resumen (discount rates, AUM, investment allocation %, bond spreads,
survey ranges with no matching column) is NEVER enough on its own to justify a new row.
- If a row already exists for the same (pais, sector, periodo) — even if ciudad/subzona/tipo
  differ — attach the extra info_resumen text to THAT row instead of creating a new one.
  Prefer the closest match (same ciudad/tipo too) but don't require an exact match on every field.
- Only skip the data entirely if there is truly no row anywhere for that pais/sector/periodo.

━━━ TIME SERIES — ONE ROW PER YEAR ━━━

When a chart or table shows the same metric across multiple years → ONE ROW PER YEAR.
Never collapse a time series. Each year = its own row with periodo = that year.
Reading values from visual charts is allowed — estimate from bar/line position if no label.
Example: cap rate chart 2013–2022 for Oficinas → 10 rows, each with cap_rate = that year's value.
Do this for EVERY multi-year chart or table in the document.

━━━ MULTIPLE SERIES IN ONE CHART ━━━

Oficinas + Industrial + Retail on the same chart → separate rows for each sector per year.
Transaction-based vs survey-based data → use tipo to distinguish ("Transacciones" vs "Clase A - Encuesta GP").

━━━ FORMATTING ━━━

- Strip % and $ from EVERY numeric value, no exceptions: store 8.5 not "8.5%", store 92.86 not
  "92.86%", store 19.42 not "$19.42". This applies to disponibilidad, ocupación, cap_rate, and
  every other metric column equally — never leave the % or $ sign in a stored value.
- One row per unique (pais, ciudad, subzona, sector, tipo, periodo) combination
- Set null for any identity/metric field not present — do not guess`;
}

// ── Generate written analysis from pre-aggregated data ────────────────────────
// Called after SQL aggregation — Claude only writes the analysis, doesn't fetch data.
export async function generateAnalysis(aggregatedData, question, history = []) {
  const client = makeClient();

  const { metric_cards = [], by_subzona = [], trend = [], city_total, latest_periodo } = aggregatedData;

  // Format the data compactly for Claude
  const metricsText = metric_cards
    .filter(c => !c.missing)
    .map(c => `${c.label}: ${c.value} ${c.unit} (${c.period || latest_periodo})`)
    .join('\n');

  const subzonaText = by_subzona.slice(0, 20).map(r =>
    `${r.subzona || r.ciudad}: renta ${r.renta_prom_m2_mes ?? '—'}, disp ${r.disponibilidad != null ? (r.disponibilidad < 1 ? (r.disponibilidad*100).toFixed(1)+'%' : r.disponibilidad+'%') : '—'}`
  ).join('\n');

  const trendText = trend.slice(-8).map(r =>
    `${r.periodo}: renta ${r.renta_prom_m2_mes ?? '—'}, disp ${r.disponibilidad != null ? (r.disponibilidad < 1 ? (r.disponibilidad*100).toFixed(1)+'%' : r.disponibilidad+'%') : '—'}`
  ).join('\n');

  const historyContext = history.length > 0
    ? `\nConversation context:\n${history.map(h => `- "${h.query}": ${h.summary}`).join('\n')}\n`
    : '';

  // Include info_resumen for complex questions
  const complexKeywords = ['riesgo', 'red flag', 'alerta', 'invertir', 'due diligence', 'oportunidad', 'recomend'];
  const isComplex = complexKeywords.some(k => (question || '').toLowerCase().includes(k));
  const notesText = isComplex && city_total?.info_resumen
    ? `\nBroker notes: ${city_total.info_resumen}\n` : '';

  const message = await client.messages.create({
    model:       MODEL,
    max_tokens:  1500,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools: [{
      name: 'analysis_response',
      description: 'Written market analysis response with optional charts',
      input_schema: {
        type: 'object',
        required: ['report_md', 'gaps', 'suggestions', 'charts'],
        properties: {
          report_md:   { type: 'string', description: '2-4 paragraphs in Spanish. Synthesize trends, investment implications, key observations. Do NOT just restate the numbers — interpret them.' },
          gaps:        { type: 'array', items: { type: 'string' }, description: 'Data gaps or caveats the user should know' },
          suggestions: { type: 'array', items: { type: 'string' }, description: '2-3 suggested follow-up questions in Spanish' },
          charts: {
            type: 'array',
            description: '0-3 charts that visualize key patterns. bar = compare subzones/markets side by side. line = show trend over time. Use ONLY numbers already in the data provided — do not invent values.',
            items: {
              type: 'object',
              required: ['type', 'title', 'labels', 'datasets'],
              properties: {
                type:   { type: 'string', enum: ['bar', 'line'] },
                title:  { type: 'string' },
                labels: { type: 'array', items: { type: 'string' }, description: 'X-axis labels (subzone names or period strings)' },
                datasets: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['label', 'values'],
                    properties: {
                      label:  { type: 'string' },
                      values: { type: 'array', items: { type: 'number' }, description: 'One value per label, null if missing' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }],
    tool_choice: { type: 'tool', name: 'analysis_response' },
    messages: [{
      role: 'user',
      content: `${historyContext}
Market data summary:

KEY METRICS (most recent period):
${metricsText || '(no metrics available)'}

BY SUBZONE (latest period per subzone, sorted by rent):
${subzonaText || '(no subzone data)'}

TREND (city total over time):
${trendText || '(no trend data)'}
${notesText}
Question/angle for analysis: "${question || 'Provide a general market overview and investment outlook.'}"

Write a sharp analytical response. Where helpful, include 1-3 charts in the charts array:
- Use a bar chart to compare subzones on renta or disponibilidad
- Use a line chart for the trend data over time
- Only include a chart if it adds clarity beyond the text
Use only numbers from the data above — do not invent values.`,
    }],
  });

  console.log(`[market-data] generate analysis — input: ${message.usage.input_tokens}, output: ${message.usage.output_tokens}`);

  const toolUse = message.content.find(b => b.type === 'tool_use');
  if (!toolUse) throw new Error('[market-data] analysis_response tool not called');
  return toolUse.input;
}

// ── Tool schemas ──────────────────────────────────────────────────────────────

const RESPONSE_TOOL = {
  name: 'market_response',
  description: 'Structured market intelligence response',
  input_schema: {
    type: 'object',
    required: ['summary', 'metric_cards', 'sources', 'gaps', 'report_md'],
    properties: {
      summary:      { type: 'string' },
      metric_cards: {
        type: 'array',
        items: {
          type: 'object',
          required: ['label', 'value', 'unit', 'missing'],
          properties: {
            label:   { type: 'string' },
            value:   { type: ['string', 'null'] },
            unit:    { type: 'string' },
            missing: { type: 'boolean' },
            period:  { type: ['string', 'null'] },
            source:  { type: ['string', 'null'] },
          },
        },
      },
      table: {
        anyOf: [
          { type: 'object', required: ['title','headers','rows'],
            properties: { title: { type: 'string' }, headers: { type: 'array', items: { type: 'string' } }, rows: { type: 'array', items: { type: 'array' } } } },
          { type: 'null' },
        ],
      },
      charts: {
        type: 'array',
        items: {
          type: 'object',
          required: ['type','title','labels','datasets'],
          properties: {
            type:     { type: 'string', enum: ['bar','line','grouped_bar'] },
            title:    { type: 'string' },
            labels:   { type: 'array', items: { type: 'string' } },
            datasets: { type: 'array', items: { type: 'object',
              properties: { label: { type: 'string' }, values: { type: 'array', items: { type: ['number','null'] } }, color: { type: ['string','null'] } } } },
          },
        },
      },
      sources:   { type: 'array', items: { type: 'string' } },
      gaps:      { type: 'array', items: { type: 'string' } },
      report_md: { type: 'string' },
    },
  },
};

const EXTRACT_TOOL = {
  name: 'extract_market_rows',
  description: 'Extracted market data rows matching the spreadsheet column structure',
  input_schema: {
    type: 'object',
    required: ['rows', 'source_description'],
    properties: {
      rows: {
        type: 'array',
        items: {
          type: 'object',
          required: ['pais', 'sector'],
          properties: {
            pais:          { type: 'string' },
            ciudad:        { type: ['string','null'] },
            subzona:       { type: ['string','null'] },
            sector:        { type: 'string', enum: ['Industrial','Oficinas','Retail'] },
            tipo:          { type: ['string','null'] },
            periodo:       { type: ['string','null'] },
            fecha:         { type: ['string','null'] },
            referencia:    { type: ['string','null'] },
            tendencia:     { type: ['string','null'], enum: ['Positiva','Negativa','Estable','Mixta', null] },
            info_resumen:  { type: ['string','null'] },
            source_type:   { type: 'string', enum: ['pasted_text','pdf'] },
          },
          additionalProperties: true, // extra metric columns from the sheet go here; non-sheet metrics go in info_resumen
        },
      },
      source_description: { type: 'string' },
      extraction_notes:   { type: ['string','null'] },
      new_columns:        { type: 'array', items: { type: 'string' }, description: 'Any new column names found in this content that are NOT in the existing spreadsheet' },
    },
  },
};
