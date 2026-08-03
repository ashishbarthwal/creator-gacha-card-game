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

/* WHY THIS LIST EXISTS SEPARATELY, and it is the sharp edge of the whole screen.
   Wikidata gives many items SEVERAL P31 values, so a performer type and a
   corporate type can both be present. YouTube itself is tagged "YouTube channel"
   AND "public company" — and on a naive "any performer type keeps it" rule, the
   corporation gets a card. A tag saying what a thing is ON cannot outrank one
   saying what it IS.

   The obvious inverse — organisation always wins — is just as wrong, because
   creator collectives incorporate: Sidemen, NELK, GameGrumps, h3h3Productions,
   Yes Theory, OfflineTV and Kurzgesagt are all filed as "organization",
   "business" or "company". Sidemen is KSI, the exact person this rule exists to
   keep.

   So only UNAMBIGUOUS corporate types veto, and the merely-organisational ones
   (organization, business, company, enterprise) deliberately do NOT appear here.
   Those produce a handful of genuine disagreements per sweep — 72 the first time —
   which is small enough to read, and reading them is the honest answer. */
const HARD_CORPORATE = [
  'Q891723',   // public company
  'Q4830453',  // business ... only via the pairing below, see NOTE
  'Q18127',    // record label
  'Q2085381',  // publishing house
  'Q3918',     // university
  'Q163740',   // nonprofit organization
  'Q327333',   // government agency
  'Q33506',    // museum
  'Q431603',   // advocacy group
  'Q7075',     // library
  'Q15265344', // broadcaster
  'Q1616075',  // television channel
  'Q369747',   // video streaming service? (platform-shaped)
  'Q7278',     // political party
];

/* NOTE on Q4830453 (business): it vetoes ONLY when the item has no performer
   type at all, which the sweep already handles by requiring one. Listing it here
   would cut Wendover Productions and RedLetterMedia, both one person. */

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
/* WHICH SIDE OF THE NOTABILITY GATE TO SWEEP.

   The en-wiki join is not just a quality screen, it is what makes phase 1 fast —
   it is the most selective triple in the query. But it is also a CEILING: once
   reach-5 had taken every anglophone performer with an English article, the route
   was exhausted by construction, and TASKS.md has said so since.

   `not-en` sweeps the complement — items carrying P2397 that pass every other
   screen and simply have no English article. Wikidata has plenty: a creator can
   have an item from a non-English wiki, from a music or film database import, or
   from a redlink someone catalogued anyway. Sweeping the complement rather than
   widening to `any` is the point — it never re-walks the ~17k already in the
   pool, so the result set stays small and every id it returns is new.

   The other screens are untouched. A channel found this way still has to be a
   performer type and still has to be anglophone: this lowers the notability bar,
   not the risk bar. */
const SITELINK_CLAUSE = {
  en:       '?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .',
  'not-en': 'FILTER NOT EXISTS { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }',
  any:      '',
};

/* PHASE 1 IS NOW A PROPERTY SCAN AND NOTHING ELSE, and that is a fix rather than
   a simplification. The seven FILTER NOT EXISTS clauses used to live here, which
   worked only because the en-wiki join in front of them was selective enough to
   cut the row count first. Sweeping the complement removes that join, the
   filters go from cheap to quadratic, every shard times out, and the recovery
   path — split into ten and retry — turns one slow query into a thousand. The
   first `--sitelink not-en` run did exactly that and had to be killed.

   Every screen those filters expressed now rides in phase 2 instead, over a
   bounded VALUES list, which is the shape WDQS is actually fast at. Nothing is
   relaxed: the same claims decide the same way, one phase later. */
function sweepQuery(prefix, sitelink = 'en') {
  return `
SELECT DISTINCT ?item ?itemLabel ?yt WHERE {
  ?item wdt:P2397 ?yt .
  ${SITELINK_CLAUSE[sitelink] ?? SITELINK_CLAUSE.en}
  FILTER( STRSTARTS(STRAFTER(STR(?item), "/Q"), "${prefix}") )
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;
}

/* PHASE 2 — what is this thing, and where is it from. Both screens ride in one
   pass over a bounded VALUES list, which is the shape WDQS is fast at. */
/* Every screen, one row per item.

   BIND(EXISTS{...}) rather than OPTIONAL{...BIND(1)}: an OPTIONAL emits a row per
   match, so an item with three P31 values and two citizenships used to come back
   six times, and with nine screens riding along that cross product is what makes
   a 250-item chunk expensive. EXISTS asks the same question and answers it once. */
function classifyQuery(items) {
  return `
SELECT ?item ?performer ?corporate ?anglo ?dead ?india ?office ?party ?crime ?blockedOcc WHERE {
  VALUES ?item { ${items.map(q).join(' ')} }
  BIND(EXISTS { ?item wdt:P31 ?k . VALUES ?k { ${PERFORMER_TYPES.map(q).join(' ')} } } AS ?performer)
  BIND(EXISTS { ?item wdt:P31 ?c . VALUES ?c { ${HARD_CORPORATE.filter(id => id !== 'Q4830453').map(q).join(' ')} } } AS ?corporate)
  BIND(EXISTS { ?item (wdt:P27|wdt:P17|wdt:P495) ?p . VALUES ?p { ${ANGLOPHONE.map(q).join(' ')} } } AS ?anglo)
  BIND(EXISTS { ?item wdt:P570 ?d } AS ?dead)
  BIND(EXISTS { ?item (wdt:P27|wdt:P17) wd:Q668 } AS ?india)
  BIND(EXISTS { ?item wdt:P39 ?o } AS ?office)
  BIND(EXISTS { ?item wdt:P102 ?pp } AS ?party)
  BIND(EXISTS { ?item wdt:P1399 ?cr } AS ?crime)
  BIND(EXISTS { ?item wdt:P106 ?oc . VALUES ?oc { ${BLOCK_OCCUPATION.map(q).join(' ')} } } AS ?blockedOcc)
}`;
}

function arg(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? fallback : (process.argv[i + 1] ?? fallback);
}

async function main() {
  const out = resolve(ROOT, arg('--out', 'catalog/wikidata-sweep.txt'));
  const pending = (arg('--shards') ?? '1,2,3,4,5,6,7,8,9').split(',').map(s => s.trim()).filter(Boolean);
  const sitelink = arg('--sitelink', 'en');
  if (!(sitelink in SITELINK_CLAUSE)) {
    console.error(`--sitelink must be one of: ${Object.keys(SITELINK_CLAUSE).join(', ')}`);
    process.exit(1);
  }
  console.log(`Sweeping P2397 — sitelink mode "${sitelink}".`);

  const found = new Map();
  while (pending.length) {
    const prefix = pending.shift();
    let rows = null;
    let err = '';
    for (let attempt = 1; attempt <= 2 && !rows; attempt++) {
      try { rows = await sparql(sweepQuery(prefix, sitelink)); }
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
  console.log(`\nClassifying ${found.size} items — performer type, territory, and every exclusion...`);
  const items = [...found.values()].map(v => v.item);
  const verdict = new Map();
  const yes = v => v?.value === 'true';
  const CHUNK = 250;
  for (let i = 0; i < items.length; i += CHUNK) {
    let rows = null;
    for (let a = 1; a <= 3 && !rows; a++) {
      try { rows = await sparql(classifyQuery(items.slice(i, i + CHUNK))); }
      catch { await new Promise(r => setTimeout(r, 2500)); }
    }
    if (!rows) { console.log(`  chunk at ${i} FAILED — those ids are dropped`); continue; }
    for (const r of rows) {
      verdict.set(r.item.value.split('/').pop(), {
        performer: yes(r.performer), corporate: yes(r.corporate), anglo: yes(r.anglo),
        dead: yes(r.dead), india: yes(r.india), office: yes(r.office),
        party: yes(r.party), crime: yes(r.crime), blockedOcc: yes(r.blockedOcc),
      });
    }
    if ((i / CHUNK) % 20 === 0) console.log(`  ${i}/${items.length} classified`);
  }

  /* THE CORPORATE VETO NOW ACTUALLY RUNS, and until this commit it did not.
     `corporate` was queried, collected into a Set, and never read — the keep
     rule asked only `performer && anglo`. So the screen this file spends thirty
     lines justifying as "the sharp edge of the whole screen" was dead code, and
     the exact case it was written for walked straight through: YouTube, Netflix,
     NBA, Apple, LEGO, Red Bull, TED and National Geographic are all P31 "YouTube
     channel" — a performer type — AND P31 public company or broadcaster. They
     passed as performers because nothing ever asked the second question.

     That is a large part of why 8,430 institutions are sitting in the staged
     exclude file waiting to be reviewed by hand: they were let in by a sweep
     that reported itself as having excluded them. Fixing it here stops future
     sweeps re-importing what the review is currently removing. */
  const swept = found.size;
  const reasons = { unclassified: 0, notPerformer: 0, corporate: 0, notAnglo: 0, excluded: 0 };
  for (const [yt, v] of [...found]) {
    const f = verdict.get(v.item);
    if (!f) { reasons.unclassified++; found.delete(yt); continue; }
    if (!f.performer) { reasons.notPerformer++; found.delete(yt); continue; }
    if (f.corporate) { reasons.corporate++; found.delete(yt); continue; }
    if (!f.anglo) { reasons.notAnglo++; found.delete(yt); continue; }
    if (f.dead || f.india || f.office || f.party || f.crime || f.blockedOcc) {
      reasons.excluded++; found.delete(yt); continue;
    }
  }
  console.log(`\n  ${swept} swept -> ${found.size} kept`);
  console.log(`    dropped: ${reasons.notPerformer} not a performer · ${reasons.corporate} corporate veto · ` +
              `${reasons.notAnglo} non-anglophone · ${reasons.excluded} excluded claim · ${reasons.unclassified} unclassified`);

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
