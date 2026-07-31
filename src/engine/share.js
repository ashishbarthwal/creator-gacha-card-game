/* engine/share — PURE. The text and the filename a shared card carries. The
   drawing is ui/share.js; this is the part worth pinning with tests.

   WHY THE STAMP EXISTS, AND WHY IT IS NOT ON THE CARD IN THE APP.
   Recorded in DECISIONS.md while studying Wikigacha's card: its CC BY-SA line
   lives on the pack art and the page footer, not on the card face. We follow the
   same split for a different reason. Our disclaimer is risk management rather
   than an attribution debt, and **the risk peaks when a card leaves our page** —
   in the app the footer is right there, carrying the unofficial notice and the
   opt-out address. A PNG travels without any of that: posted to a timeline, it
   is a picture of a real person's name, face and statistics with nothing around
   it saying who made it or that nobody endorsed it.

   So the export is the one place the disclaimer is burned into the pixels. It
   cannot be cropped off without visibly cropping the card, and it survives every
   re-share, which page context does not.

   The wording names YouTube deliberately. That is nominative use — identifying
   the platform the data describes — and it is exactly the descriptive use the
   rename kept in the tagline. What the name slot may not do is assert a
   relationship, which is why the sentence exists to deny one. */

/* "2026-08-01" -> "August 2026". Returns '' for anything unparseable, including
   the starter set's deliberately empty snapshotDate — those channels are
   invented, so there is no snapshot to date and claiming one would be a lie in
   the one place we are being careful to tell the truth. */
export function monthLabel(snapshotDate) {
  /* Matched strictly rather than handed to Date.parse, which is alarmingly
     lenient: an earlier version tested `length === 7` to spot "YYYY-MM" and so
     turned the string "someday" into `Date.parse('someday-01')`, which V8
     happily reads as December 2000. A caption that invents a date is the exact
     failure this file exists to avoid, so the shape is checked before parsing. */
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(String(snapshotDate ?? '').trim());
  if (!match) return '';
  const [, year, month] = match;
  const monthIndex = Number(month) - 1;
  if (monthIndex < 0 || monthIndex > 11) return '';
  const d = new Date(Date.UTC(Number(year), monthIndex, 1));
  return `${d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })} ${d.getUTCFullYear()}`;
}

/* The line burned into the exported image. The stats clause is dropped rather
   than left blank when there is no snapshot, so an undated card reads as a
   complete sentence instead of "stats as of ·". */
export function shareCaption({ snapshotDate } = {}) {
  const month = monthLabel(snapshotDate);
  return [
    'Unofficial fan card',
    month ? `stats as of ${month}` : null,
    'not affiliated with YouTube or Google',
  ].filter(Boolean).join('  ·  ');
}

/* Filenames are seen in a downloads folder and in whatever the sharer uploads
   to, so they carry the project name — the one piece of provenance that
   survives even if the image is cropped. ASCII-only and length-capped, because
   a CJK or emoji channel title makes a filename some systems will not write. */
export function slugify(text, { max = 40 } = {}) {
  const slug = String(text ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')      // strip accents, keep the letters
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/, '');
  return slug;
}

export function shareFilename(card) {
  const name = slugify(card?.channel?.title);
  const rarity = String(card?.rarity ?? '').toLowerCase();
  /* A title of nothing but emoji or punctuation slugifies to '', which would
     yield "creator-gacha--ur.png". The channel id is the guaranteed-present
     fallback, and it is already ASCII. */
  const stem = name || slugify(card?.channel?.id) || 'card';
  return `creator-gacha-${stem}${rarity ? `-${rarity}` : ''}.png`;
}
