// Serialises structured data for a <script type="application/ld+json"> block.
//
// JSON.stringify() is NOT safe for this. The HTML parser ends a <script> at
// the first `</script` it sees, before any JSON parser is involved, so a string
// value containing `</script><script>…` closes our block and opens one of its
// own. Several values that reach JSON-LD here are typed by outside parties —
// a company's name and website come from the employer panel, a job's title
// from a public form — so this is a stored XSS path, not a hypothetical.
//
// Escaping `<`, `>` and `&` as \uXXXX keeps the output valid JSON that decodes
// to the identical value, while leaving the HTML parser nothing to act on.
// U+2028/U+2029 are escaped too: legal in JSON, but line terminators in older
// JavaScript parsers.
//
// Every JSON-LD block on the site goes through this (via components/JsonLd.tsx);
// `npm run seo:verify` asserts both the escaping and that no page inlines
// JSON.stringify into dangerouslySetInnerHTML again.
//
// Deliberately NOT `server-only`: pure string work, imported by the verify
// script under plain tsx.

const UNSAFE = /[<>&\u2028\u2029]/g;

const ESCAPES: Record<string, string> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
};

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(UNSAFE, (ch) => ESCAPES[ch]);
}
