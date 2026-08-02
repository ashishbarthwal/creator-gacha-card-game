#!/usr/bin/env node
/* tools/wikidata-sweep — the default sourcing route, and the cheapest one.
   Sweeps Wikidata for every item that carries property P2397 (YouTube channel
   id) and has an English Wikipedia article, then writes a roster file that
   tools/add-candidates.js consumes.

   WHY THIS EXISTS AS A COMMITTED TOOL. It produced catalog/reach-5.txt — 16,887
   of the pool's candidates — from a throwaway script, which meant the most
   important sourcing route in the project lived nowhere and could not be re-run,
   reviewed or corrected. The route is now the documented default, so it is code.

   COST: zero Wikidata quota (WDQS is free) and ~0.02 YouTube units per candidate,
   since ids batch 50 to a channels.list call. For comparison: curated public
   rankings cost ~1.2, and keyword search ~11.5.

   ── THE SCREENS, all of them structural ──────────────────────────────────────
   Every filter below is a Wikidata CLAIM, not a regex over prose. reach-4 learned
   the hard way that a text screen "catches 'political' and misses 'anti-ideology'";
   a claim has no such failure mode, and asking the database what a thing IS beats
   guessing from what it is called.

   A PERSON GETS A CARD. AN INSTITUTION DOES NOT.  (2026-08-03)
   The P31 screen is the one that matters most, and it is a RISK rule rather than
   a taste one. A creator has no reason to mind being on a card; a company,
   university or trade association has a trademark budget, a legal team and a
   written policy about its marks. The downside is asymmetric, and personalities
   are the one thing this project is not short of.

   A BAND IS A PERFORMER. Arctic Monkeys and The White Stripes are kept for the
   same reason KSI is; their RECORD LABEL is not. That distinction is the whole
   rule in a line, and it is why the screen is an explicit KEEP list of
   performer-shaped types rather than "anything that is not a human".

   Getting this wrong once cost 8,379 cards pulled out of a LIVE deck via
   catalog/excluded.txt. Refusing them here is the same decision made before any
   quota is spent.

   Run:   node tools/wikidata-sweep.js                    (full sweep -> roster)
          node tools/wikidata-sweep.js --out catalog/reach-7.txt
          node tools/wikidata-sweep.js --shards 1,2,3     (resume/partial)
   Then:  node tools/add-candidates.js catalog/reach-7.txt

   No YouTube key needed here — this step only produces ids. add-candidates.js
   spends the quota. */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const UA = 'CreatorGacha/1.0 (portfolio project; ashish.barthwal.cs@gmail.com)';
const ENDPOINT = 'https://query.wikidata.org/sparql';

/* ── who is NOT a card ───────────────────────────────────────────────────────
   Occupations we do not want, for the reasons reach-4.txt argued by hand:
   politics and news are a different kind of risk, and adult content is out. */
const BLOCK_OCCUPATION = [
  'Q82955',    // politician
  'Q1930187',  // journalist
  'Q11499147', // news presenter
  'Q488111',   // pornographic actor
  'Q1607826',  // televangelist
];

/* Territories whose creators the launch audience recognizes. Recorded as a
   deliberate, revisable narrowing — a second-language printing is where it gets
   revisited, and the ids it drops are set aside rather than lost. */
const ANGLOPHONE = ['Q30', 'Q145', 'Q16', 'Q408', 'Q664', 'Q27'];

/* ── the institution screen ──────────────────────────────────────────────────
   An explicit KEEP list, because "not a human" would throw away every band. */
const PERFORMER_TYPES = [
  'Q5',        // human
  'Q215380',   // musical group
  'Q5741069',  // rock band
  'Q9212979',  // musical duo
  'Q2088357',  // musical ensemble
  'Q7623897',  // comedy troupe
  'Q17558136', // YouTube channel
];

const q = id => 'wd:' + id;

async function sparql(query) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ query }),
  });
  if (!res.ok) throw new Error(`SPARQL ${res.status}`);
  return (await res.json()).results.bindings;
}

/* TWO PHASES, AND THE SPLIT IS FORCED BY THE QUERY SERVICE, not by taste.
   Putting the P31 and territory joins into the sweep itself is the obvious
   single-query design and it times out: WDQS gives a query 60 seconds, and those
   joins pushed even a narrow shard past it. Sweeping ids cheaply and then
   classifying them in chunks keeps every request small, and a chunk that fails
   costs 250 ids to retry rather than the whole shard.

   PHASE 1 — the sweep. Deliberately light: only the filters expressible as
   cheap FILTER NOT EXISTS clauses. WDQS has no modulo, so shards are Q-number
   string prefixes, and a shard that times out splits into ten narrower ones. */
function sweepQuery(prefix) {
  return `
SELECT DISTINCT ?item ?itemLabel ?yt WHERE {
  ?item wdt:P2397 ?yt .
  ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
  FILTER( STRSTARTS(STRAFTER(STR(?item), "/Q"), "${prefix}") )
  FILTER NOT EXISTS { ?item wdt:P570 ?death }                                    # deceased
  FILTER NOT EXISTS { ?item wdt:P27 wd:Q668 }                                    # India hedge
  FILTER NOT EXISTS { ?item wdt:P17 wd:Q668 }
  FILTER NOT EXISTS { ?item wdt:P39 ?office }                                    # held public office
  FILTER NOT EXISTS { ?item wdt:P102 ?party }                                    # political party
  FILTER NOT EXISTS { ?item wdt:P1399 ?crime }                                   # convicted of
  FILTER NOT EXISTS { ?item wdt:P106 ?occ . VALUES ?occ { ${BLOCK_OCCUPATION.map(q).join(' ')} } }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;
}

/* PHASE 2 — what is this thing, and where is it from. Both screens ride in one
   pass over a bounded VALUES list, which is the shape WDQS is fast at. */
function classifyQuery(items) {
  return `
SELECT ?item ?performer ?anglo WHERE {
  VALUES ?item { ${items.map(q).join(' ')} }
  OPTIONAL { ?item wdt:P31 ?k . VALUES ?k { ${PERFORMER_TYPES.map(q).join(' ')} } BIND(1 AS ?performer) }
  OPTIONAL { ?item (wdt:P27|wdt:P17|wdt:P495) ?p . VALUES ?p { ${ANGLOPHONE.map(q).join(' ')} } BIND(1 AS ?anglo) }
}`;
}

function arg(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? fallback : (process.argv[i + 1] ?? fallback);
}

async function main() {
  const out = resolve(ROOT, arg('--out', 'catalog/wikidata-sweep.txt'));
  const pending = (arg('--shards') ?? '1,2,3,4,5,6,7,8,9').split(',').map(s => s.trim()).filter(Boolean);

  const found = new Map();
  while (pending.length) {
    const prefix = pending.shift();
    let rows = null;
    let err = '';
    for (let attempt = 1; attempt <= 2 && !rows; attempt++) {
      try { rows = await sparql(sweepQuery(prefix)); }
      catch (e) { err = e.message; await new Promise(r => setTimeout(r, 3000)); }
    }
    if (!rows) {
      /* A timeout means the shard is too big — split it rather than lose it. */
      if (prefix.length < 4) {
        for (const d of '0123456789') pending.push(prefix + d);
        console.log(`  Q${prefix}*: too big, split into 10`);
      } else console.log(`  Q${prefix}*: FAILED — ${err}`);
      continue;
    }
    for (const r of rows) {
      const yt = r.yt.value.trim();
      if (/^UC[\w-]{22}$/.test(yt) && !found.has(yt)) {
        found.set(yt, { name: r.itemLabel?.value ?? '', item: r.item.value.split('/').pop() });
      }
    }
    console.log(`  Q${prefix}*: ${rows.length} rows -> ${found.size} unique ids (${pending.length} shards left)`);
  }

  /* Phase 2. A channel is kept only if Wikidata says it IS a performer AND it is
     tied to an English-speaking territory. Both are positive tests: an item that
     fails to classify is dropped rather than waved through, because the whole
     point is that an institution should never need to be noticed to be excluded. */
  console.log(`\nClassifying ${found.size} items — performer type and territory...`);
  const items = [...found.values()].map(v => v.item);
  const performer = new Set();
  const anglo = new Set();
  const CHUNK = 250;
  for (let i = 0; i < items.length; i += CHUNK) {
    let rows = null;
    for (let a = 1; a <= 3 && !rows; a++) {
      try { rows = await sparql(classifyQuery(items.slice(i, i + CHUNK))); }
      catch { await new Promise(r => setTimeout(r, 2500)); }
    }
    if (!rows) { console.log(`  chunk at ${i} FAILED — those ids are dropped`); continue; }
    for (const r of rows) {
      const id = r.item.value.split('/').pop();
      if (r.performer) performer.add(id);
      if (r.anglo) anglo.add(id);
    }
    if ((i / CHUNK) % 20 === 0) console.log(`  ${i}/${items.length} — ${performer.size} performers, ${anglo.size} anglophone`);
  }

  const swept = found.size;
  for (const [yt, v] of [...found]) {
    if (!performer.has(v.item) || !anglo.has(v.item)) found.delete(yt);
  }
  console.log(`\n  ${swept} swept -> ${found.size} kept (institutions and non-anglophone dropped)`);

  const lines = [
    '# Generated by tools/wikidata-sweep.js — ids only, screened on Wikidata claims.',
    '# A person gets a card, an institution does not: the sweep requires P31 to be a',
    '# performer type (human, band, duo, comedy troupe, YouTube channel), so',
    '# businesses, universities, nonprofits, labels and TV series never reach here.',
    `# ${found.size} channels, swept ${new Date().toISOString().slice(0, 10)}.`,
    '#',
    '# Next:  node tools/add-candidates.js ' + arg('--out', 'catalog/wikidata-sweep.txt'),
    '',
    ...[...found].map(([yt, v]) => `${yt}  # ${String(v.name).replace(/[\r\n#]/g, ' ').trim()}`),
  ];
  await writeFile(out, lines.join('\n') + '\n');
  console.log(`\nWrote ${out} — ${found.size} channel ids.`);
  console.log('Spend the quota with:  node tools/add-candidates.js <that file>');
}

main().catch(err => { console.error(err); process.exit(1); });
