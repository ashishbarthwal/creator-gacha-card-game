#!/usr/bin/env node
/* tools/reinstate — put dropped cards back.
   Reads reports/dropped-review.txt, finds the lines marked with a leading `+`,
   and deletes those ids from catalog/excluded.txt.

   WHY THIS EXISTS. The institution screen decides the easy 95% mechanically —
   universities, school districts and record labels are not judgement calls. But
   "Sidemen and OfflineTV are fun-oriented and belong in the game" is a judgement
   about what the game is FOR, and no Wikidata claim encodes that. Ash's call
   (2026-08-03): the machine proposes, a human disposes, after EVERY filtration
   rather than once. This is the second half of that loop.

   It is deliberately a two-file, two-step flow:

     reports/dropped-review.txt   gitignored, carries titles and subscriber
                                  counts, ranked by size — the thing a person
                                  actually reads
     catalog/excluded.txt         committed, ids only — the thing git records

   The split is the same one the whole candidate DB is built on: channel data
   never enters git, because git is permanent and both the 30-day statistics cap
   and a performable removal depend on it not being.

   The `+` mark echoes the `!` pin marker the roster files already use — one
   leading character, easy to add in any editor, impossible to add by accident.

   Run:   node tools/reinstate.js
          node tools/reinstate.js --dry-run
          node tools/reinstate.js --from reports/other-review.txt

   No key, no network, no quota. Rebuild afterwards to ship the change. */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const EXCLUDED_PATH = resolve(ROOT, 'catalog/excluded.txt');

function arg(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? fallback : (process.argv[i + 1] ?? fallback);
}

const ID = /^\+\s*(UC[\w-]{22})\b(.*)$/;

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const reviewPath = resolve(ROOT, arg('--from', 'reports/dropped-review.txt'));

  const review = await readFile(reviewPath, 'utf8').catch(() => null);
  if (review === null) {
    console.error(`No review file at ${reviewPath}.`);
    console.error('Run  node tools/build-set.js  to generate one.');
    process.exit(1);
  }

  /* A marked line keeps its `# Name [subs]` comment, which is exactly what makes
     the report readable — so the name is pulled off for the log and then thrown
     away rather than written anywhere. */
  const marked = new Map();
  for (const line of review.split(/\r?\n/)) {
    const m = ID.exec(line.trim());
    if (m) marked.set(m[1], (m[2].split('#')[1] ?? '').trim());
  }

  if (!marked.size) {
    console.log(`Nothing marked in ${arg('--from', 'reports/dropped-review.txt')}.`);
    return console.log('Put a + at the start of a line to put that card back, then re-run.');
  }

  const excluded = await readFile(EXCLUDED_PATH, 'utf8');
  const lines = excluded.split(/\r?\n/);
  const kept = [];
  const removed = [];
  for (const line of lines) {
    const id = line.split('#')[0].trim();
    if (id && marked.has(id)) { removed.push(id); continue; }
    kept.push(line);
  }

  const notFound = [...marked.keys()].filter(id => !removed.includes(id));

  console.log(`${marked.size} marked for reinstatement.`);
  for (const id of removed) console.log(`  + ${marked.get(id) || id}`);
  for (const id of notFound) console.log(`  ! ${id} was not in catalog/excluded.txt — already shipping, or never excluded`);

  if (dryRun) return console.log('\n--dry-run: nothing written.');
  if (!removed.length) return console.log('\nNothing to change.');

  await writeFile(EXCLUDED_PATH, kept.join('\n'));
  console.log(`\nRemoved ${removed.length} id${removed.length === 1 ? '' : 's'} from catalog/excluded.txt.`);
  console.log('Commit that file, then rebuild:  npm run deploy');
}

main().catch(err => { console.error(err); process.exit(1); });
