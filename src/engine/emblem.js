/* engine/emblem — PURE. A deterministic generated emblem for a channel: same
   channel in, same picture out, with no network and no canvas.

   This is the seed of WP11, not WP11 itself. The full proposal (semantic
   classification, a themed icon library) stays unbuilt; what exists here is the
   piece the launch actually needs — a real alternative to a creator's profile
   photo that can be switched on by config. DECISIONS.md (2026-07-31) made that
   switch a launch prerequisite rather than hardening, because it is what keeps
   shipping real pictures REVERSIBLE: if a creator objects, or the read of the
   room changes, flipping it is a config change and a redeploy instead of a
   rewrite.

   The artwork is deliberately the demo set's, which shipped in WP4 and has
   been looked at on a real screen: a two-stop gradient disc carrying the
   channel's initial. Reusing a proven visual beats inventing a second one for
   the fallback path, and it means the emblem build looks like the app rather
   than like a degraded version of it. data/demo.js now imports this instead
   of keeping its own copy.

   Pure and headless — it returns a string, touches no DOM, and runs unchanged
   in Node, which is why it lives here and can be tested without a browser. */

/* Same hash shape as ui/card.js's accent fallback: stable across runs and
   platforms, and spread across the hue circle so two channels rarely collide.
   Keyed on the channel id, never the title — an id is immutable, so a creator
   renaming themselves does not silently repaint their card. */
function hueFrom(seed) {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h % 360;
}

/* The first character of the title, uppercased. Uses the spread form so an
   astral-plane character (an emoji channel name is common) counts as one
   character rather than half a surrogate pair. */
export function initialFor(title) {
  return [...String(title ?? '')][0]?.toUpperCase() ?? '?';
}

/* An SVG data URI, so it drops straight into the same <img src> a real avatar
   uses and every downstream path — the ring, the tilt, the reveal — needs no
   knowledge that it is looking at a generated image.

   XML-escaped because a channel title is untrusted text and this string becomes
   markup. The URI is then percent-encoded, which is what makes it safe to
   interpolate into an HTML attribute downstream. */
const XML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const escapeXml = s => String(s).replace(/[&<>"']/g, c => XML_ESCAPES[c]);

/* `hue` and `initial` are overridable so the demo set can keep the art
   direction it was authored with — those eight channels are invented, their
   colours were chosen to spread across the wheel and have been looked at, and
   deriving them from a fabricated id instead would repaint a reviewed visual for
   no gain. Real channels pass neither and get the deterministic derivation. */
export function emblemFor(channel, { size = 120, hue, initial } = {}) {
  const h = Number.isFinite(hue) ? ((hue % 360) + 360) % 360 : hueFrom(channel?.id ?? '');
  const glyph = escapeXml(initial ?? initialFor(channel?.title));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 120 120">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${h},72%,52%)"/>` +
    `<stop offset="1" stop-color="hsl(${(h + 40) % 360},68%,34%)"/>` +
    `</linearGradient></defs>` +
    `<rect width="120" height="120" fill="url(#g)"/>` +
    `<text x="60" y="62" font-family="Arial Black, Arial, sans-serif" font-size="56" font-weight="900" ` +
    `fill="rgba(255,255,255,0.92)" text-anchor="middle" dominant-baseline="central">${glyph}</text>` +
    `</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

/* The accent an emblem implies, so a card in emblem mode tints its frame to
   match its own artwork instead of sampling an image that is no longer there.
   Same hue as the gradient's first stop, by construction. */
export function emblemAccent(channel) {
  return `hsl(${hueFrom(channel?.id ?? '')} 70% 55%)`;
}
