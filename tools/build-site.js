#!/usr/bin/env node
/* tools/build-site — assemble the deployable site into _site/.
   No key, no network: it only copies what tools/build-set.js already produced.

   WHY THIS RUNS LOCALLY AND NOT IN CI. The deploy needs to hydrate channel IDs
   into live statistics, which needs an API key. The built set cannot be
   committed — a set file in git is permanent, which satisfies neither YouTube's
   30-day cap on stored statistics nor a promise that a removal is actually
   performable. So the one machine that can both hold a key and publish without
   writing to a git history is the operator's own, and the site is uploaded
   straight to the CDN from here (Cloudflare Pages direct upload, via wrangler)
   rather than deployed by an Action. GitHub Actions keeps running the test
   suite, which needs no key.

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

import { refreshStatus, REFRESH_DAYS, POLICY_DAYS } from '../src/engine/freshness.js';

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
  /* The policy pages are named here for the same reason everything else is: the
     copy is an allowlist, so a page that exists in the repo and not in this list
     is a page that 404s in production while looking fine locally. Both are gate
     items (TASKS.md, WP10) and the footer links to them, so a missing one is a
     broken promise rather than a missing file. */
  await cp(from('privacy.html'), to('privacy.html'));
  await cp(from('terms.html'), to('terms.html'));
  await cp(from('styles.css'), to('styles.css'));
  /* Caching and security headers. It has to travel INSIDE the uploaded folder:
     this is a direct upload, so the host never reads the repo or runs a build
     step of its own. The `_headers` file syntax happens to be identical between
     Netlify and Cloudflare Pages, which is why this file needed no changes when
     the host did. */
  await cp(from('_headers'), to('_headers'));
  await cp(from('src'), to('src'), { recursive: true });
  /* Gitignored, so it is absent from a clean checkout — removed anyway, because
     this script runs on the machine that HAS one. */
  await rm(to('src/config.local.js'), { force: true });

  /* The committed manifest ships EMPTY, and that is not an oversight. It used to
     carry the fictional "Arcade Legends" sample, which was scaffolding to prove
     the fetched-set adapter worked; next to a real 1,200-card Series 1 it was
     just a second fake option on a public site, so it was deleted (2026-08-01).
     The empty file stays because banner.js fetches it with warnOnFail, and a 404
     would show a visitor an error about a set list they never asked for. */
  await cp(from('sets/index.json'), to('sets/index.json'));

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

  /* THE STALENESS GUARD. The other two guards keep data out that must never
     ship; this one keeps data out that has simply aged past what the Developer
     Policies allow us to store (30 days on statistics).

     It refuses at the policy cap and only warns at the 25-day cadence, because
     refusing at 25 would block a day-26 publish of data that is still perfectly
     compliant — and a guard people learn to route around protects nothing while
     looking like it does.

     An undated set is refused too. "No snapshotDate" is not "fine", it is "its
     age cannot be established", and the only safe reading of that is closed.
     The remedy is never a flag: it is `node tools/build-set.js`, which
     re-hydrates every id and resets the clock for ~13 quota units. */
  const stale = [];
  for (const f of files.filter(f => f.includes('built') && f.endsWith('.json') && !f.endsWith('index.json'))) {
    const set = JSON.parse(await readFile(f, 'utf8'));
    const status = refreshStatus(set.snapshotDate);
    if (!status.publishable) stale.push({ f, status, slug: set.slug });
    else if (status.state === 'due') {
      console.warn(`  ! ${set.slug}: ${status.ageDays} days old — past the ${REFRESH_DAYS}-day cadence, ` +
        `${status.expiresInDays} day${status.expiresInDays === 1 ? '' : 's'} before it may not be published. Rebuild soon.`);
    }
  }
  if (stale.length) {
    console.error(`Refusing to build: a set is past the ${POLICY_DAYS}-day cap on stored statistics.`);
    for (const { f, status, slug } of stale) {
      console.error(`  ${relative(ROOT, f)} — ${slug}: ` +
        (status.state === 'unknown' ? 'no snapshotDate, age cannot be established' : `${status.ageDays} days old`));
    }
    console.error('\nFix:  node tools/build-set.js     (re-hydrates every id, ~13 quota units, no searches)');
    process.exit(1);
  }

  /* THE DEAD-LINK GUARD, and it is really a guard on the allowlist above. Adding
     a page means editing two places — the repo and the copy list — and forgetting
     the second produces a 404 that is invisible locally, where the file is simply
     there. Rather than trust the next person to remember, ask the assembled site
     whether every page it links to actually shipped. Same shape as the guards
     above: cheap, and it only earns its keep on the day someone edits the list
     without thinking. */
  const missing = [];
  for (const f of files.filter(f => f.endsWith('.html'))) {
    const html = await readFile(f, 'utf8');
    for (const [, href] of html.matchAll(/href="([^"#?:]+\.html)"/g)) {
      if (!await exists(resolve(dirname(f), href))) missing.push(`${relative(SITE, f)} -> ${href}`);
    }
  }
  if (missing.length) {
    console.error('Refusing to build: a shipped page links to a page that did not ship.');
    for (const m of missing) console.error(`  ${m.replace(/\\/g, '/')}`);
    console.error('\nFix: add it to the copy allowlist at the top of tools/build-site.js.');
    process.exit(1);
  }

  const sets = files.filter(f => f.includes('sets') && f.endsWith('.json'));
  console.log(`_site assembled — ${files.length} files, ${sets.length} set/manifest JSON.`);
  for (const f of sets) console.log(`  ${relative(SITE, f).replace(/\\/g, '/')}`);
  console.log('\nNo drafts, no dev manifests, no country fields.');
  console.log('Upload:  npx wrangler pages deploy _site --project-name=creator-gacha --branch=main');
}

main().catch(err => { console.error(err); process.exit(1); });
