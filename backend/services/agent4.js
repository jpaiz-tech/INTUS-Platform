import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname     = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR   = path.resolve(__dirname, '../prompts');
const ANTI_AI_STYLE = path.resolve(__dirname, '../reference/ANTI-AI-WRITING-STYLE.md');

const client = new Anthropic();

export async function runAgent4({ industry, agent1Summary, agent3Output }) {
  const antiAiStyle  = readFileSync(ANTI_AI_STYLE, 'utf8').trim();
  const agentPrompt  = readFileSync(path.join(PROMPTS_DIR, 'agent4.txt'), 'utf8').trim();
  const systemPrompt = antiAiStyle + '\n\n---\n\n' + agentPrompt;

  const sector = agent3Output.sectorObject || {};

  const userMessage = `Industry: ${industry}

Agent 1 Executive Summary:
${agent1Summary}

Agent 3 Scoring Data:
${JSON.stringify({
  name:         sector.name,
  sub:          sector.sub,
  score:        sector.score,
  reco: {
    verdict:    sector.reco?.verdict,
    text:       sector.reco?.text,
    capexNote:  sector.reco?.capexNote,
    risks:      sector.reco?.risks,
  },
  tabs: (sector.tabs || []).map(tab => ({
    shortLabel: tab.shortLabel,
    score:      tab.score,
    assets:     tab.assets,
    dims: (tab.dims || []).map(dim => ({
      label: dim.label,
      score: dim.score,
      subs:  (dim.subs || []).map(s => ({
        n:               s.n,
        score:           s.score,
        note:            s.note,
        spaceCriticality: s.spaceCriticality,
      })),
    })),
  })),
  dimScores: sector.dimScores,
}, null, 2)}`;

  const response = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 4000,
    system:     systemPrompt,
    messages:   [{ role: 'user', content: userMessage }],
  });

  const raw = response.content[0].text.trim();

  // Strip markdown fences, remove trailing commas, extract JSON boundaries
  let cleaned = raw.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/im, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const noTrailing = cleaned.replace(/,(\s*[}\]])/g, '$1');
    try {
      return JSON.parse(noTrailing);
    } catch {
      const start = cleaned.search(/[{[]/);
      const end   = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
      if (start !== -1 && end > start) {
        return JSON.parse(cleaned.slice(start, end + 1).replace(/,(\s*[}\]])/g, '$1'));
      }
      throw new Error(`Agent 4 returned invalid JSON: ${cleaned.slice(0, 200)}`);
    }
  }
}
