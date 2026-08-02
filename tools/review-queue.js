#!/usr/bin/env node
/* tools/review-queue — the standing list of dropped cards Ash works through.

   WHY THIS IS NOT reports/dropped-review.txt. That file is a SNAPSHOT: build-set
   rewrites it from scratch on every build, so a mark made on Tuesday is gone by
   Wednesday's rebuild. Review is not a single sitting — it is 8,524 channels
   read a slice at a time over days — so the working copy has to survive the
   thing that regenerates it.

   So there are two artifacts with two lifetimes, which is the same split this
   project keeps making:

     reports/dropped-review.txt   SNAPSHOT — what the last build dropped
     reports/review-queue.txt     WORKING COPY — accumulates, keeps your marks

   This merges the former into the latter. Marks (`+`) and any notes you have
   typed are preserved; newly-dropped channels are appended to their band; a
   channel that is no longer excluded (you reinstated it, or the screen changed)
   is dropped from the queue so the file only ever shows live decisions.

   ONLY UR, SSR AND SR ARE LISTED (Ash, 2026-08-03). Recognition is what review
   is FOR, and below SR there is none to recover: an R-band institution is a 300K
   trade body nobody has heard of, and N is 6,767 school districts. Reviewing to
   SR is 607 lines instead of 8,524, and the 607 contain every decision that can
   change how the game feels.

   The unreviewed bands stay EXCLUDED but stay LISTED, in catalog/excluded.txt —
   `--bands UR,SSR,SR,R,N` brings them back into the queue. A decision not to
   look is not a decision to delete, and keeping the ids is what preserves the
   difference.

   Gitignored, like everything carrying titles and subscriber counts. Your
   decisions become id deletions in catalog/excluded.txt, which is what git
   records.

   Run:   node tools/review-queue.js              (merge the latest snapshot in)
          node tools/review-queue.js --status     (how far through you are)
          node tools/review-queue.js --bands R,N --out reports/review-queue-RN.txt
                                                  (the bands review skips, kept
                                                   on disk and ready to mark)
   Then:  node tools/reinstate.js --from reports/review-queue.txt

   No key, no network, no quota. */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { RARITY_ORDER } from '../src/engine/core.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SNAPSHOT = resolve(ROOT, 'reports/dropped-review.txt');
const DEFAULT_QUEUE = 'reports/review-queue.txt';

/* `UC...  # Name [23.3M] SSR   <- anything you typed` , optionally +marked. */
const LINE = /^(\+?)\s*(UC[\w-]{22})\s*#\s*(.*?)\s*\[([^\]]*)\]\s*(\w+)\s*(.*)$/;

function parse(text) {
  const rows = new Map();
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const m = LINE.exec(raw.trim());
    if (!m) continue;
    const [, mark, id, title, subs, band, note] = m;
    rows.set(id, { id, title, subs, band, marked: mark === '+', note: note.trim() });
  }
  return rows;
}

const SUB = /^([\d.]+)([KM]?)$/;
function subsValue(s) {
  const m = SUB.exec(String(s));
  if (!m) return 0;
  return Number(m[1]) * (m[2] === 'M' ? 1e6 : m[2] === 'K' ? 1e3 : 1);
}

/* REVIEW STOPS AT SR (Ash, 2026-08-03). R and N are not worth a person's
   attention: an R-band institution is a 300K-subscriber trade body nobody
   recognizes, and the N section is 6,767 school districts. The value of review
   is concentrated where recognition is, and that is SR and above — 607 lines
   instead of 8,524.

   The bands below are still EXCLUDED, just not reviewed; the ids sit in
   catalog/excluded.txt and can be recovered any time by widening this flag. A
   decision not to look is not the same as a decision to delete, and keeping them
   listed is what preserves the difference. */
const REVIEW_BANDS = ['UR', 'SSR', 'SR'];

function arg(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? fallback : (process.argv[i + 1] ?? fallback);
}

async function main() {
  const statusOnly = process.argv.includes('--status');
  const bands = new Set(String(arg('--bands', REVIEW_BANDS.join(','))).split(',').map(b => b.trim().toUpperCase()));
  /* --out keeps the R/N list as its own standing file rather than making the
     working queue swap contents depending on the last flag someone typed. Two
     files, each with a stable meaning, beats one file with a mode. */
  const QUEUE = resolve(ROOT, arg('--out', DEFAULT_QUEUE));

  const snapshot = parse(await readFile(SNAPSHOT, 'utf8').catch(() => ''));
  const existing = parse(await readFile(QUEUE, 'utf8').catch(() => ''));

  if (!snapshot.size && !existing.size) {
    console.error('No snapshot at reports/dropped-review.txt and no queue yet.');
    console.error('Run  node tools/build-set.js  first.');
    process.exit(1);
  }

  /* The snapshot is the authority on WHO is dropped; the queue is the authority
     on what you have said about them. Merge in that direction and neither can
     overwrite the other's job. */
  const merged = new Map();
  let added = 0;
  let skipped = 0;
  for (const [id, row] of snapshot) {
    /* Filtered here rather than at write time, so the counts reported below are
       about the queue a person actually has to read. */
    if (!bands.has(row.band)) { skipped++; continue; }
    const prior = existing.get(id);
    if (prior) merged.set(id, { ...row, marked: prior.marked, note: prior.note });
    else { merged.set(id, row); added++; }
  }
  const gone = [...existing.keys()].filter(id => !snapshot.has(id));

  const rows = [...merged.values()];
  const marked = rows.filter(r => r.marked);

  if (statusOnly) {
    console.log(`review queue — ${rows.length} dropped channels`);
    console.log(`  ${marked.length} marked to reinstate`);
    for (const band of [...RARITY_ORDER].reverse()) {
      const inBand = rows.filter(r => r.band === band);
      if (inBand.length) console.log(`  ${band.padEnd(4)} ${String(inBand.length).padStart(5)}  (${inBand.filter(r => r.marked).length} marked)`);
    }
    return;
  }

  const out = [
    '# REVIEW QUEUE — cards the curation exclude dropped, for Ash to overrule.',
    '#',
    '# HOW TO USE: put a + at the start of any line you want back in the game,',
    '# and type a note after it if you like. Then:',
    '#     node tools/reinstate.js --from reports/review-queue.txt',
    '#',
    '# Your marks SURVIVE rebuilds — re-run  node tools/review-queue.js  after a',
    '# build and this file is merged, not replaced. (reports/dropped-review.txt is',
    '# the raw snapshot and IS replaced every time; do not mark that one.)',
    '#',
    `# ONLY ${[...bands].join(', ')} ARE LISTED. R and N are excluded from the game but not`,
    '# from the file that records them — an R-band institution is a 300K trade body',
    '# nobody recognizes, and N is 6,767 school districts. They stay in',
    '# catalog/excluded.txt and come back any time with:',
    '#     node tools/review-queue.js --bands UR,SSR,SR,R,N',
    '#',
    '# Not committed — these lines carry titles and subscriber counts, which are',
    '# channel data. Only the ids in catalog/excluded.txt enter git.',
    '#',
    `# ${rows.length} channels · ${marked.length} marked · updated ${new Date().toISOString().slice(0, 10)}`,
  ];

  for (const band of [...RARITY_ORDER].reverse()) {
    const inBand = rows.filter(r => r.band === band)
      .sort((a, b) => subsValue(b.subs) - subsValue(a.subs));
    if (!inBand.length) continue;
    out.push('');
    out.push(`# ══ ${band} — ${inBand.length} dropped ${'═'.repeat(Math.max(0, 46 - band.length))}`);
    for (const r of inBand) {
      out.push(`${r.marked ? '+' : ''}${r.id}  # ${r.title} [${r.subs}] ${r.band}${r.note ? '   ' + r.note : ''}`);
    }
  }

  await mkdir(resolve(ROOT, 'reports'), { recursive: true });
  await writeFile(QUEUE, out.join('\n') + '\n');

  console.log(`${arg('--out', DEFAULT_QUEUE)} — ${rows.length} channels`);
  if (added) console.log(`  +${added} newly dropped since the last merge`);
  if (skipped) console.log(`  ${skipped} in bands not under review (${[...bands].join('/')} only) — still excluded, just not listed`);
  if (gone.length) console.log(`  −${gone.length} no longer excluded (reinstated, or the screen changed)`);
  console.log(`  ${marked.length} currently marked to reinstate`);
  for (const band of [...RARITY_ORDER].reverse()) {
    const n = rows.filter(r => r.band === band).length;
    if (n) console.log(`    ${band.padEnd(4)} ${String(n).padStart(5)}`);
  }
  console.log(`\nMark lines with +, then:  node tools/reinstate.js --from ${arg('--out', DEFAULT_QUEUE)}`);
}

main().catch(err => { console.error(err); process.exit(1); });
