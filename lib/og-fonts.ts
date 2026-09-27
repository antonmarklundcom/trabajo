import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Fonts and text hygiene for the generated Open Graph cards
// (app/opengraph-image.tsx, app/empleos/[slug]/opengraph-image.tsx).
//
// Without a `fonts` option next/og draws everything in its one bundled font,
// Geist Regular: every fontWeight on the card is silently ignored, so the
// title, the company and the wordmark all came out the same weight. These are
// the site's own typeface (Inter, OFL — assets/fonts/OFL.txt), latin subset,
// committed to the repo and read from disk. Nothing here touches the network,
// at build or at render time.
//
// No `server-only` import: node:fs already keeps this out of a client bundle,
// and scripts/verify-seo.ts evaluates ogText() without the react-server
// condition.

type OgFont = { name: string; data: ArrayBuffer; weight: 400 | 600 | 800; style: 'normal' };

let fontsPromise: Promise<OgFont[]> | null = null;

async function loadFont(file: string): Promise<ArrayBuffer> {
  const buf = await readFile(join(process.cwd(), 'assets/fonts', file));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/** Inter 400/600/800, read once per process. Pass as ImageResponse's `fonts`. */
export function ogFonts(): Promise<OgFont[]> {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      loadFont('inter-latin-400-normal.woff'),
      loadFont('inter-latin-600-normal.woff'),
      loadFont('inter-latin-800-normal.woff'),
    ]).then(([regular, semibold, extrabold]) => [
      { name: 'Inter', data: regular, weight: 400, style: 'normal' },
      { name: 'Inter', data: semibold, weight: 600, style: 'normal' },
      { name: 'Inter', data: extrabold, weight: 800, style: 'normal' },
    ]);
    // A failed read must not be cached for the life of the process.
    fontsPromise.catch(() => {
      fontsPromise = null;
    });
  }
  return fontsPromise;
}

// The unicode-range of the committed Inter latin subset (@fontsource's
// latin.css). Covers Spanish in full: a-acute, n-tilde, inverted marks
// and the en dash formatSalary() puts between two amounts. The subset's
// General Punctuation block is narrowed to its visible characters: a
// zero-width joiner left over from an emoji sequence is exactly what sends
// next/og to its emoji loader.
const DRAWABLE =
  /[\u0020-\u007E\u00A0-\u00FF\u0131\u0152\u0153\u02BB\u02BC\u02C6\u02DA\u02DC\u2000-\u200A\u2010-\u2027\u202F-\u205F\u20AC\u2122\u2212]/;

/**
 * Employer-typed text, reduced to what the card can draw from the fonts above.
 *
 * For a glyph no loaded font has, next/og falls back to fetching a font from
 * Google Fonts; for an emoji it fetches an SVG from a CDN, and that path has
 * no error handling. A job title is typed by an outside party, so one emoji in
 * it must not turn a share preview into an outbound request or a broken image.
 * Pictographs go first because next/og routes some of them (©, ™) to its emoji
 * loader even when the font has the glyph.
 */
export function ogText(input: string | null | undefined): string {
  if (!input) return '';
  return Array.from(input.normalize('NFC').replace(/\p{Extended_Pictographic}/gu, ''))
    .filter((ch) => DRAWABLE.test(ch))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}
