import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = path.resolve(__dirname, '../data/runs');

export const manualRouter = express.Router();

manualRouter.post('/', async (req, res) => {
  const { industry, agent, rawOutput } = req.body;

  if (!industry || typeof industry !== 'string' || industry.trim() === '') {
    return res.status(400).json({ error: 'industry is required.' });
  }
  if (!agent || typeof agent !== 'string' || agent.trim() === '') {
    return res.status(400).json({ error: 'agent is required.' });
  }
  if (!rawOutput || typeof rawOutput !== 'string' || rawOutput.trim() === '') {
    return res.status(400).json({ error: 'rawOutput is required and must not be empty.' });
  }

  const now = new Date().toISOString();
  const run = {
    id: uuidv4(),
    industry: industry.trim(),
    status: 'completed',
    createdAt: now,
    updatedAt: now,
    agent: agent.trim(),
    model: 'manual-claude',
    mode: 'manual',
    rawOutput: rawOutput.trim(),
    error: null,
  };

  try {
    await fs.mkdir(RUNS_DIR, { recursive: true });
    await fs.writeFile(
      path.join(RUNS_DIR, `${run.id}.json`),
      JSON.stringify(run, null, 2),
      'utf8'
    );
  } catch (err) {
    return res.status(500).json({ error: `Failed to save run: ${err.message}` });
  }

  return res.json({ run });
});
