#!/usr/bin/env node
/* tools/build-site — assemble the deployable site into _site/.
   No key, no network: it only copies what tools/build-set.js already produced.

   WHY THIS RUNS LOCALLY AND NOT IN CI. The deploy needs to hydrate channel IDs
   into live statistics, which needs an API key. The built set cannot be
   committed — a set file in git is permanent, which satisfies neither YouTube's
   30-day cap on stored statistics nor a promise that a removal is actually
   performable. So the one machine that can both hold a key and publish without
   writing to a git history is the operator's own, and the site is uploaded
   straight to the CDN from here (Netlify direct upload) rather than deployed by
   an Action. GitHub Actions keeps running the test suite, which needs no key.

   The trade, stated because it is real: the 25-day refresh becomes a chore
   somebody has to remember instead of a cron job.

   THE COPY IS AN ALLOWLIST, and that is the whole design. `sets/` also holds
   Magic Search's draft — real creator data with `country` intact — so a
   recursive copy of that directory would publish it and walk straight past the
   strip. Name what ships; never name what doesn't.

   Run:   node tools/build-site.js
          npm run deploy      (build set -> assemble -> upload) */

import { rm, mkdir, cp, readdir, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SITE = resolve(ROOT, '_site');

const from = p => resolve(ROOT, p);
const to = p => resolve(SITE, p);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function main() {
  await rm(SITE, { recursive: true, force: true });
  await mkdir(to('sets'), { recursive: true });

  await cp(from('index.html'), to('index.html'));
  await cp(from('styles.css'), to('styles.css'));
  await cp(from('src'), to('src'), { recursive: true });
  /* Gitignored, so it is absent from a clean checkout — removed anyway, because
     this script runs on the machine that HAS one. */
  await rm(to('src/config.local.js'), { force: true });

  await cp(from('sets/index.json'), to('sets/index.json'));
  await cp(from('sets/sample-series.json'), to('sets/sample-series.json'));

  if (!await exists(from('sets/built'))) {
    console.error('No sets/built — run  node tools/build-set.js  first.');
    process.exit(1);
  }
  await cp(from('sets/built'), to('sets/built'), { recursive: true });

  /* The assemble above is already an allowlist, so these should never fire.
     They exist because the cost of being wrong is publishing the exact data the
     project promises not to retain — a cheap check against an expensive
     mistake, and the kind that only earns its keep on the day someone edits the
     copy list without thinking. */
  const files = await walk(SITE);
  const leaked = files.filter(f => /\.draft\.json$|index\.local\.json$/.test(f));
  if (leaked.length) {
    console.error('Refusing to build: a draft or dev manifest reached _site.');
    for (const f of leaked) console.error(`  ${relative(ROOT, f)}`);
    process.exit(1);
  }

  const withCountry = [];
  for (const f of files.filter(f => f.includes(`${'sets'}`) && f.endsWith('.json'))) {
    if ((await readFile(f, 'utf8')).includes('"country"')) withCountry.push(f);
  }
  if (withCountry.length) {
    console.error('Refusing to build: a shipped set carries a country field.');
    for (const f of withCountry) console.error(`  ${relative(ROOT, f)}`);
    process.exit(1);
  }

  const sets = files.filter(f => f.includes('sets') && f.endsWith('.json'));
  console.log(`_site assembled — ${files.length} files, ${sets.length} set/manifest JSON.`);
  for (const f of sets) console.log(`  ${relative(SITE, f).replace(/\\/g, '/')}`);
  console.log('\nNo drafts, no dev manifests, no country fields.');
  console.log('Upload:  npx netlify-cli deploy --prod --dir=_site');
}

main().catch(err => { console.error(err); process.exit(1); });
