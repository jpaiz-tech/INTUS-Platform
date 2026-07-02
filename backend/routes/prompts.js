import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = path.resolve(__dirname, '../../prompts');

export const promptsRouter = express.Router();

promptsRouter.post('/agent1', async (req, res) => {
  const { industry } = req.body;

  if (!industry || typeof industry !== 'string' || industry.trim() === '') {
    return res.status(400).json({ error: 'industry is required and must be a non-empty string.' });
  }

  let systemPrompt;
  try {
    systemPrompt = await fs.readFile(path.join(PROMPTS_DIR, 'agent1.txt'), 'utf8');
  } catch (err) {
    return res.status(500).json({ error: `Could not read agent1.txt: ${err.message}` });
  }

  const fullPrompt = `${systemPrompt.trim()}\n\nSector a investigar: ${industry.trim()}`;

  return res.json({
    industry: industry.trim(),
    agent: 'agent1',
    prompt: fullPrompt,
  });
});
