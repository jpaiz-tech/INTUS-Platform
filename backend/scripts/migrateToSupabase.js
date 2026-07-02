/**
 * Migration: populates all Supabase tables from existing data.
 *
 * Run AFTER createSchema.sql has been applied in the Supabase SQL editor:
 *   node scripts/migrateToSupabase.js
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_KEY in .env.
 * Safe to run multiple times — all writes are upserts.
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import supabase from '../utils/supabaseClient.js';
import { writeSectorToDatabase } from '../services/sectorDb.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DASHBOARD_PATH = process.env.DASHBOARD_FILE_PATH
  || path.resolve(__dirname, '../dashboard/etra_capex_v1_6_0_5_iro_5.html');

async function extractSectorsFromHtml(htmlPath) {
  const html = await fs.readFile(htmlPath, 'utf8');
  const match = html.match(/(?:const|let|var)\s+DATA\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) throw new Error('Could not find DATA array in dashboard HTML');
  const script = match[0].replace(/^(?:const|let)\s/, 'var ');
  const ctx = {};
  vm.runInNewContext(script, ctx);
  if (!Array.isArray(ctx.DATA)) throw new Error('DATA is not an array after parsing');
  return ctx.DATA;
}

async function main() {
  if (!supabase) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_KEY not set. Aborting.');
    process.exit(1);
  }

  // ── Source 1: existing Supabase sectors ──────────────────────────────────
  console.log('Reading sectors from Supabase...');
  const { data: dbRows, error: dbErr } = await supabase
    .from('sectors')
    .select('name, sector_data');

  if (dbErr) {
    console.error('Could not read Supabase sectors:', dbErr.message);
    process.exit(1);
  }

  const dbSectors = (dbRows || [])
    .map(r => r.sector_data)
    .filter(Boolean);

  console.log(`  Found ${dbSectors.length} sectors in Supabase`);

  // ── Source 2: dashboard HTML (may contain sectors not yet in Supabase) ──
  let htmlSectors = [];
  try {
    htmlSectors = await extractSectorsFromHtml(DASHBOARD_PATH);
    console.log(`  Found ${htmlSectors.length} sectors in dashboard HTML`);
  } catch (e) {
    console.warn(`  Could not read dashboard HTML (${e.message}) — skipping HTML source`);
  }

  // Merge: HTML sectors take precedence if they're not already in Supabase
  const seen = new Set(dbSectors.map(s => s.name));
  const htmlOnly = htmlSectors.filter(s => s.name && !seen.has(s.name));
  const allSectors = [...dbSectors, ...htmlOnly];

  console.log(`\nMigrating ${allSectors.length} sectors to normalized tables...\n`);

  let ok = 0;
  let fail = 0;

  for (const sector of allSectors) {
    if (!sector.name) { fail++; continue; }

    try {
      await writeSectorToDatabase(
        sector,
        null,
        { industry: sector.name, researchMode: 'migration' },
        { skipRunRecord: true }
      );
      console.log(`  OK    ${sector.name} (score: ${sector.scoreExact ?? sector.score})`);
      ok++;
    } catch (err) {
      console.error(`  FAIL  ${sector.name}: ${err.message}`);
      fail++;
    }
  }

  console.log(`\nDone — ${ok} migrated, ${fail} failed`);
}

main().catch(err => { console.error(err); process.exit(1); });
