#!/usr/bin/env node
/* ONE-OFF, not part of the committed pipeline: a first thinning pass over the
   staged institution list, at Ash's direction — "filter out govt/municipality
   and big companies, leave the rest (small channels won't care)".

   Reads reports/dropped-review.txt (gitignored, all 8,430 staged institutions,
   every band, titles + subs — regenerated fresh today by build-set.js), splits
   it into two CUT buckets:
     - government/municipal, by name pattern, across every band (a state or
       county channel is often tiny, so band-restricting would miss it)
     - big companies, restricted to UR/SSR/SR (526 entries — small enough that
       every one was read by hand, not just regexed), minus named exceptions:
       personality-run collectives misfiled as "corporate" because they
       incorporated (Sidemen-shaped problem CLAUDE.md already names), plus
       universities, nonprofits, religious orgs, and political/advocacy media
       left for a real human pass rather than guessed at here.

   Output: reports/thinning-cut.txt (proposed ids to promote from staged to
   settled) for Ash to read before anything touches catalog/excluded.txt. */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const LINE = /^(UC[\w-]{22})\s*#\s*(.*?)\s*\[([^\]]*)\]\s*(\w+)\s*$/;

function parse(text) {
  const rows = [];
  for (const raw of text.split(/\r?\n/)) {
    const m = LINE.exec(raw.trim());
    if (m) rows.push({ id: m[1], title: m[2], subs: m[3], band: m[4] });
  }
  return rows;
}

/* ── government / municipal, name pattern, any band ── */
const GOV_PATTERNS = [
  /\b(city|county|township|borough) of\b/i,
  /\bstate of\b/i,
  /\bcity council\b/i,
  /\bcounty (government|commission|schools|public)\b/i,
  /\bsheriff'?s? (office|department)\b/i,
  /\bpolice department\b/i,
  /\bfire (department|rescue)\b/i,
  /\bpublic schools\b/i,
  /\bschool district\b/i,
  /\bministry of (?!sound\b)/i, // "Ministry of Sound" is a record label, not government
  /\bdepartment of\b/i,
  /\bgovernment of\b/i,
  /\bparliament\b/i,
  /\bhouse of representatives\b/i,
  /\b(u\.?s\.?|united states) (army|navy|air force|marine corps|coast guard|space force)\b/i,
  /\bnational guard\b/i,
  /\bembassy\b/i,
  /\bconsulate\b/i,
];
const GOV_NAMED = [
  'United Nations', 'Canadian Space Agency', 'NASA', 'Competition Bureau Canada',
  'The Royal Family', 'Pinal County Sheriff', 'Metropolitan Police', 'NHS',
  'Pentagon', 'European Commission', 'European Parliament',
  // "White House" alone false-positives on "White House Black Market" (a clothing
  // retailer) and "White House Historical Association" (a private nonprofit, not
  // a government body) — neither belongs here, so the bare name is deliberately
  // NOT listed; nothing in this pass actually needed it.
];
/* Named false positives caught by manual review, not by a broader pattern:
   "Unshackled" is a radio drama MADE BY a church ("a ministry of Pacific Garden
   Mission" — church jargon for "program run by"), not a government ministry. */
const GOV_FALSE_POSITIVES = ['Unshackled - A Ministry of Pacific Garden Mission'];

function isGov(title) {
  if (GOV_FALSE_POSITIVES.includes(title)) return false;
  if (GOV_PATTERNS.some(p => p.test(title))) return true;
  return GOV_NAMED.some(n => title.includes(n));
}

/* ── big companies, restricted to UR/SSR/SR — that band slice was read in
   full by hand (526 lines), not regexed, so the exception list below IS the
   judgment call, and it is deliberately narrow: only named things, nothing
   inferred. Anything not named here and in UR/SSR/SR is being treated as a
   company. R and N are not touched by this bucket at all — a company that
   small reads as "small business", which is the category Ash said to leave. */
const KEEP_EXCEPTIONS = [
  // personality-run collectives misfiled as corporate (incorporated, not institutional)
  'Beast Philanthropy', 'Corridor Digital', 'Corridor Crew', 'The Game Theorists',
  'ERB', 'Beta Squad', 'ExplosmEntertainment', 'How It Should Have Ended',
  'The Try Guys', 'FaZe Clan', 'Hype House', 'Achievement Hunter', '100 Thieves',
  'Jet Lag: The Game', 'Gamers Nexus', 'thejuicemedia', 'Sesame Workshop',
  // universities
  'Berklee College of Music', 'Harvard University', 'Stanford Graduate School of Business',
  'Stanford',
  // nonprofits / charities / health / education
  'PETA', 'Special Olympics', 'Environmental Defense Fund', 'Humane World for Animals',
  'Mayo Clinic', 'Khan Academy', 'freeCodeCamp.org', 'Y Combinator', 'Quanta Magazine',
  'USAFacts', 'Games Done Quick', 'Songkick', 'Youtooz', 'Calm', 'Nothing', 'Innersloth',
  'Evrim Ağacı', 'Escandalosos', 'Winding Road Magazine', 'Hoover Institution',
  // low-confidence tail of SR — small/ambiguous, erring toward leaving rather than guessing
  'QOVES', 'Wayne', 'Love Medical', 'the fifth estate', 'NRG', 'Headspace',
  'TheMostPopularGirls', 'Audiotree', 'Fugget About It', 'Caltex Records', 'Avang Music',
  // religious
  'Church of Jesus Christ of Latter-day Saints', 'Elevation Church', 'Life.Church',
  'Ascension Presents', 'EWTN', 'TBN', 'Superbook', 'The Chosen', 'Yaqeen Institute',
  'CanZion',
  // political / advocacy media — sensitive, out of scope of this pass
  'PragerU', 'Turning Point USA', 'Young America’s Foundation', "Young America's Foundation",
  'Project Veritas', 'The Young Turks', 'More Perfect Union', 'Right Side Broadcasting Network',
  'David Pakman Show', 'OutKick', 'The Bulwark', 'The Babylon Bee',
  // handled separately as government/international, not "company"
  'United Nations', 'Canadian Space Agency', 'NASA', 'Pinal County Sheriff', 'The Royal Family',
];

function isKeptException(title) {
  return KEEP_EXCEPTIONS.some(n => title.includes(n));
}

async function main() {
  const text = await readFile(resolve(ROOT, 'reports/dropped-review.txt'), 'utf8');
  const rows = parse(text);
  console.log(`Parsed ${rows.length} staged institutions from reports/dropped-review.txt.`);

  const govCut = rows.filter(r => isGov(r.title));
  const bigCoCut = rows.filter(r =>
    ['UR', 'SSR', 'SR'].includes(r.band) && !isGov(r.title) && !isKeptException(r.title));

  const cutIds = new Set([...govCut, ...bigCoCut].map(r => r.id));
  const kept = rows.filter(r => ['UR', 'SSR', 'SR'].includes(r.band) && !isGov(r.title) && isKeptException(r.title));

  console.log(`\nGovernment/municipal matches (any band): ${govCut.length}`);
  const byBand = {};
  for (const r of govCut) byBand[r.band] = (byBand[r.band] ?? 0) + 1;
  console.log('  by band:', byBand);

  console.log(`\nBig-company cut (UR/SSR/SR, minus named exceptions): ${bigCoCut.length}`);
  console.log(`Named exceptions kept (not cut): ${kept.length}`);

  console.log(`\nTOTAL proposed for catalog/excluded.txt: ${cutIds.size} ids`);

  const lines = [
    '# Proposed by tools/classify-institutions.js, a one-off thinning pass — not yet',
    '# applied to catalog/excluded.txt. Ash: review before promoting.',
    '#',
    `# ${govCut.length} government/municipal (any band) + ${bigCoCut.length} big companies (UR/SSR/SR).`,
    '',
    '# ── GOVERNMENT / MUNICIPAL ──',
    ...govCut.sort((a, b) => b.band.localeCompare(a.band)).map(r => `${r.id}  # ${r.title} [${r.subs}] ${r.band}`),
    '',
    '# ── BIG COMPANIES (UR/SSR/SR) ──',
    ...bigCoCut.map(r => `${r.id}  # ${r.title} [${r.subs}] ${r.band}`),
    '',
    '# ── KEPT EXCEPTIONS (NOT cut — for reference) ──',
    ...kept.map(r => `${r.id}  # ${r.title} [${r.subs}] ${r.band}`),
  ];
  await writeFile(resolve(ROOT, 'reports/thinning-cut.txt'), lines.join('\n') + '\n');
  console.log('\nWrote reports/thinning-cut.txt for review.');
}

main().catch(err => { console.error(err); process.exit(1); });
