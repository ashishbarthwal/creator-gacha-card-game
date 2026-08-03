#!/usr/bin/env node
/* ONE-OFF companion to classify-institutions.js: promotes the ids it proposed
   (reports/thinning-cut.txt) from the STAGED file into the SETTLED one.

   catalog/excluded.txt is always applied; catalog/excluded-institutions.txt is
   reported but not shipped until --apply-staged. This script moves a named
   subset (government/municipal + big companies, per Ash's criteria) into the
   settled file now, and strips those same ids out of the staged file so it
   keeps representing only what's still awaiting a full human pass. */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const LINE = /^(UC[\w-]{22})\s*#\s*(.*?)\s*\[([^\]]*)\]\s*(\w+)\s*$/;

function parseSection(text, header, until) {
  const start = text.indexOf(header);
  if (start === -1) return [];
  const rest = text.slice(start + header.length);
  const endAt = until ? rest.indexOf(until) : -1;
  const body = endAt === -1 ? rest : rest.slice(0, endAt);
  const rows = [];
  for (const raw of body.split(/\r?\n/)) {
    const m = LINE.exec(raw.trim());
    if (m) rows.push({ id: m[1], title: m[2], subs: m[3], band: m[4] });
  }
  return rows;
}

async function main() {
  const cutText = await readFile(resolve(ROOT, 'reports/thinning-cut.txt'), 'utf8');
  const gov = parseSection(cutText, '# ── GOVERNMENT / MUNICIPAL ──', '# ── BIG COMPANIES');
  const bigCo = parseSection(cutText, '# ── BIG COMPANIES (UR/SSR/SR) ──', '# ── KEPT EXCEPTIONS');

  console.log(`Government/municipal: ${gov.length}`);
  console.log(`Big companies: ${bigCo.length}`);

  const settledPath = resolve(ROOT, 'catalog/excluded.txt');
  const stagedPath = resolve(ROOT, 'catalog/excluded-institutions.txt');

  const settled = await readFile(settledPath, 'utf8');
  const staged = await readFile(stagedPath, 'utf8');

  const cutIds = new Set([...gov, ...bigCo].map(r => r.id));

  const newSettledBlock = [
    '',
    '# ── Institution thinning pass, 2026-08-03 (Ash\'s criteria) ──────────────────',
    '# Promoted from catalog/excluded-institutions.txt (STAGED) rather than waiting',
    '# for full review: government/municipal channels (real trademark/legal risk',
    '# regardless of size) and big, globally recognizable companies (same risk,',
    '# and the game does not need them). Small businesses and niche institutions',
    '# in the staged file are deliberately left alone — see tools/classify-institutions.js',
    '# for the exact criteria and named exceptions (personality-run collectives,',
    '# universities, nonprofits, religious/political media held back for a full pass).',
    '#',
    `# Government / municipal (${gov.length}):`,
    ...gov.map(r => `${r.id}  # ${r.title} [${r.subs}] ${r.band}`),
    '#',
    `# Big companies (${bigCo.length}):`,
    ...bigCo.map(r => `${r.id}  # ${r.title} [${r.subs}] ${r.band}`),
  ].join('\n') + '\n';

  await writeFile(settledPath, settled.replace(/\n+$/, '\n') + newSettledBlock);

  const keptStagedLines = staged.split(/\r?\n/).filter(line => {
    const id = line.split('#')[0].trim();
    return !(id && cutIds.has(id));
  });
  await writeFile(stagedPath, keptStagedLines.join('\n'));

  console.log(`\nWrote ${cutIds.size} ids into catalog/excluded.txt.`);
  console.log(`Removed the same ids from catalog/excluded-institutions.txt (now staged-remainder only).`);
}

main().catch(err => { console.error(err); process.exit(1); });
