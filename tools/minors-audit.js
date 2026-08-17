#!/usr/bin/env node
/* tools/minors-audit — who in the SHIPPED deck is a child.

   ── WHY THIS EXISTS ───────────────────────────────────────────────────────
   "A person gets a card. An institution does not" is a RISK rule, and it is
   the only eligibility screen this project had. It says nothing about age. A
   card carries a real person's face, their name, and numbers presented as
   stats — and for an adult public figure that is the ordinary bargain of being
   a public figure, while for a fourteen-year-old it is a different category of
   thing entirely, in a way no opt-out link fixes after the fact.

   Nobody had checked. On a 22,772-card deck assembled by a sweep that screens
   on what a thing IS but never on how old they are, "probably fine" was the
   whole of what was known before this ran.

   ── IT READS THE SHIPPED SET, NOT THE CANDIDATE ROSTER ────────────────────
   sets/built/core.json is what a player actually pulls. The roster holds ids
   that excludes and region screens remove on the way to a build, so auditing
   it would report on cards that do not exist and miss nothing that does.

   ── THE SCREEN IS A CLAIM, NOT A GUESS ────────────────────────────────────
   Same principle as the P31 institution screen one tool over: ask Wikidata
   what it KNOWS (P569, date of birth) rather than inferring age from a channel
   name. There is no false-positive mode — a recorded birth date is a recorded
   birth date — so every row this prints is real, and Ash's judgement is spent
   on what to do rather than on whether to believe it.

   ── WHAT IT CANNOT SEE, STATED PLAINLY BECAUSE IT MATTERS ─────────────────
   This is a SPOT-CHECK and calling it an audit would oversell it. Three blind
   spots, in rough order of how much they should worry you:

     1. FAMILY AND KIDS' CHANNELS. A toy-unboxing or family-vlog channel is
        registered to a parent, has no date of birth on the item, and features
        children constantly. Those are arguably the highest-risk cards in the
        deck and this screen is completely blind to them. `--names` runs a
        crude keyword pass to give that blind spot a shape, and the output is a
        REVIEW list, never an action.
     2. NO WIKIDATA ITEM. A channel sourced outside the P2397 sweep may have no
        item at all, so no claim to read.
     3. AN ITEM WITH NO P569. Extremely common for creators — Wikidata records
        a birth date when someone documented one, not otherwise.

   So a clean run means "nothing KNOWN to be a minor", never "no minors".

   Run:   node tools/minors-audit.js
          node tools/minors-audit.js --names     (also run the keyword pass)
          node tools/minors-audit.js --age 21    (widen the flag threshold)

   Costs no YouTube quota — WDQS is free, and this reads a set already built. */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SET_PATH = resolve(ROOT, 'sets/built/core.json');
const OUT_PATH = resolve(ROOT, 'reports/minors-review.txt');

const UA = 'CreatorGacha/1.0 (portfolio project; ashish.barthwal.cs@gmail.com)';
const ENDPOINT = 'https://query.wikidata.org/sparql';

/* Under this on the day of the run is a minor. `--age` widens it, because the
   interesting question at launch is not only "is a card a child today" but
   "which cards become a problem while the deck sits live" — a 17-year-old and
   a 19-year-old are the same card three years from now. */
const DEFAULT_FLAG_AGE = 18;

/* WDQS gives a query 60 seconds. A VALUES list of ids joined on one indexed
   property is the shape it is fastest at (the sweep's own classify phase makes
   the same trade), so the cap here is about staying well inside that budget
   rather than about result size. */
const CHUNK = 400;

function arg(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? fallback : (process.argv[i + 1] ?? fallback);
}
const has = flag => process.argv.includes(flag);

async function sparql(query) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      Accept: 'application/sparql-results+json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ query }),
  });
  if (!res.ok) throw new Error(`SPARQL ${res.status}`);
  return (await res.json()).results.bindings;
}

/* Ask only what is needed: the channel id we already hold, the item it belongs
   to, and the birth date. No labels — the set already carries titles, and
   asking the label service to resolve thousands of items is most of what makes
   a WDQS query time out. */
const dobQuery = ids => `
SELECT ?yt ?item ?dob WHERE {
  VALUES ?yt { ${ids.map(id => `"${id}"`).join(' ')} }
  ?item wdt:P2397 ?yt .
  ?item wdt:P569 ?dob .
}`;

const ageOn = (dob, now) => (now - dob) / (365.25 * 24 * 60 * 60 * 1000);

/* ── THE KEYWORD PASS, AND WHY IT IS OPT-IN AND ADVISORY ───────────────────
   engine/discover.js keeps `looksInstitutional()` deliberately narrow because
   a name screen "reads only a name", and a false positive there deletes a real
   creator silently. The same caution applies harder here: these words appear in
   plenty of adult creators' channel names, so this list would be indefensible
   as a filter. It is not one. It produces a list for a human to read, which is
   the only thing a name screen is honestly good for — see "The machine
   proposes, Ash disposes" in CLAUDE.md. */
const KID_SIGNALS = [
  'kids', 'kid ', 'child', 'children', 'toy', 'toys', 'nursery', 'rhymes',
  'family fun', 'family vlog', 'baby', 'babies', 'toddler', 'preschool',
  'cartoon', 'playtime', 'playground', 'schoolboy', 'schoolgirl',
];

function nameFlags(channels) {
  const hits = [];
  for (const ch of channels) {
    const hay = `${ch.title ?? ''} ${ch.handle ?? ''}`.toLowerCase();
    const matched = KID_SIGNALS.filter(w => hay.includes(w));
    if (matched.length) hits.push({ ch, matched });
  }
  return hits;
}

const fmtSubs = n => {
  const v = Number(n || 0);
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return Math.round(v / 1e3) + 'K';
  return String(v);
};

async function main() {
  const flagAge = Number(arg('--age', DEFAULT_FLAG_AGE));
  const now = Date.now();

  const set = JSON.parse(await readFile(SET_PATH, 'utf8'));
  const channels = set.channels ?? [];
  console.log(`Auditing "${set.title}" — ${channels.length} shipped cards, snapshot ${set.snapshotDate}.`);
  console.log(`  flagging anyone under ${flagAge} as of today\n`);

  const byId = new Map(channels.map(ch => [String(ch.id), ch]));
  const ids = [...byId.keys()];

  const known = [];
  let queried = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    let rows;
    try {
      rows = await sparql(dobQuery(slice));
    } catch (err) {
      console.warn(`  ! chunk ${i / CHUNK + 1} failed (${err.message}) — skipped`);
      continue;
    }
    queried += slice.length;
    for (const row of rows) {
      const id = row.yt?.value;
      const raw = row.dob?.value;
      const ch = byId.get(id);
      if (!ch || !raw) continue;
      const dob = Date.parse(raw);
      if (!Number.isFinite(dob)) continue;
      known.push({ ch, dob, raw, age: ageOn(dob, now), item: row.item?.value?.split('/').pop() ?? '' });
    }
    process.stdout.write(`\r  queried ${queried}/${ids.length} — ${known.length} with a recorded birth date`);
  }
  console.log('\n');

  /* One id can carry several birth-date claims (a disputed date, a duplicate
     item). Keep the YOUNGEST, because this screen exists to find a floor and
     the cautious reading of a disagreement is the one that flags. */
  const youngest = new Map();
  for (const rec of known) {
    const prev = youngest.get(rec.ch.id);
    if (!prev || rec.age < prev.age) youngest.set(rec.ch.id, rec);
  }
  const records = [...youngest.values()].sort((a, b) => a.age - b.age);

  const minors = records.filter(r => r.age < flagAge);
  const nearly = records.filter(r => r.age >= flagAge && r.age < flagAge + 3);

  const lines = [];
  lines.push(`Creator Gacha — minors spot-check`);
  lines.push(`set: ${set.title} (${channels.length} cards, snapshot ${set.snapshotDate})`);
  lines.push(`run: ${new Date(now).toISOString()}   threshold: under ${flagAge}`);
  lines.push('');
  lines.push(`${records.length} of ${channels.length} shipped cards have a birth date recorded on Wikidata.`);
  lines.push(`That is the whole of what this can see — see the header of tools/minors-audit.js`);
  lines.push(`for the three blind spots, of which family/kids channels is the one that matters.`);
  lines.push('');
  lines.push(`UNDER ${flagAge}: ${minors.length}`);
  for (const r of minors) {
    lines.push(`  ${r.age.toFixed(1)}y  ${r.ch.id}  ${r.ch.title}  (${fmtSubs(r.ch.subscriberCount)} subs)  wikidata:${r.item}  born ${r.raw.slice(0, 10)}`);
  }
  lines.push('');
  lines.push(`${flagAge}-${flagAge + 3} (context — these age INTO safety, not out of it): ${nearly.length}`);
  for (const r of nearly.slice(0, 40)) {
    lines.push(`  ${r.age.toFixed(1)}y  ${r.ch.id}  ${r.ch.title}  (${fmtSubs(r.ch.subscriberCount)} subs)`);
  }

  if (has('--names')) {
    const hits = nameFlags(channels);
    lines.push('');
    lines.push(`NAME PASS — ${hits.length} channels whose title/handle carries a kid signal.`);
    lines.push(`ADVISORY ONLY. These words appear in plenty of adult creators' names; this is a`);
    lines.push(`list to READ, never a filter to apply. It exists because a family channel is`);
    lines.push(`registered to a parent and has no birth date to find.`);
    for (const h of hits.slice(0, 200)) {
      lines.push(`  ${h.ch.id}  ${h.ch.title}  (${fmtSubs(h.ch.subscriberCount)} subs)  [${h.matched.join(', ')}]`);
    }
    if (hits.length > 200) lines.push(`  … and ${hits.length - 200} more`);
  }

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, lines.join('\n') + '\n', 'utf8');

  console.log(`${records.length} of ${channels.length} cards have a recorded birth date.`);
  console.log(`  UNDER ${flagAge}:  ${minors.length}`);
  for (const r of minors) {
    console.log(`     ${r.age.toFixed(1)}y  ${r.ch.title}  (${fmtSubs(r.ch.subscriberCount)} subs)  ${r.ch.id}`);
  }
  console.log(`  ${flagAge}-${flagAge + 3}: ${nearly.length}`);
  if (has('--names')) console.log(`  name pass: ${nameFlags(channels).length} to review`);
  console.log(`\nWrote ${OUT_PATH}`);
  console.log('Gitignored — it carries titles and subscriber counts, which are channel data.');

  /* To remove one: add the id to catalog/denylist.json (permanent, re-enforced
     on every future sourcing run) or catalog/excluded.txt (editorial, revisable),
     then rebuild. The denylist is the right file for this — an age decision is
     not an editorial one and must not be quietly undone by a later pass. */
}

main().catch(err => { console.error(err); process.exit(1); });
