import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const dashboardOutputsRouter = express.Router();

dashboardOutputsRouter.get('/:filename', async (req, res) => {
  const { filename } = req.params;

  // Only serve .html files
  if (!filename.endsWith('.html')) {
    return res.status(404).send('Not found');
  }

  // Prevent path traversal: filename must be a plain name with no separators or ..
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..') || filename.includes('\0')) {
    return res.status(400).send('Invalid filename');
  }

  const outputDir = process.env.DASHBOARD_OUTPUT_DIR
    || path.resolve(__dirname, '../../data/dashboard-outputs');

  const filePath = path.join(outputDir, filename);

  // Extra safety: ensure resolved path is inside outputDir
  const resolvedDir  = path.resolve(outputDir);
  const resolvedFile = path.resolve(filePath);
  if (!resolvedFile.startsWith(resolvedDir + path.sep) && resolvedFile !== resolvedDir) {
    return res.status(400).send('Invalid filename');
  }

  try {
    const content = await fs.readFile(resolvedFile, 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(content);
  } catch {
    res.status(404).send('Not found');
  }
});
