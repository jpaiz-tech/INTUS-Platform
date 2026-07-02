import express from 'express';
import { runAgent2 } from '../services/agent2.js';

export const agent2Router = express.Router();

agent2Router.post('/agent2', async (req, res) => {
  const { runId } = req.body;

  if (!runId || typeof runId !== 'string' || runId.trim() === '') {
    return res.status(400).json({ error: 'runId is required and must be a non-empty string.' });
  }

  const result = await runAgent2(runId.trim());

  // Validation errors return { error, status } without a run object
  if (result.status === 400 && !result.id) {
    return res.status(400).json({ error: result.error });
  }

  if (result.status === 'failed') {
    return res.status(500).json({ error: result.error, run: result });
  }

  return res.json({ run: result });
});
