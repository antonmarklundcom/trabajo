// Asserts that components/MarkdownContent.tsx escapes raw HTML in a job
// description before rendering it through dangerouslySetInnerHTML.
//
// The sibling of scripts/verify-blog.ts §1, for the other half of the site that
// reaches dangerouslySetInnerHTML. The failure mode here is worse than the
// blog's: a blog article is committed to this repo, so whoever can publish one
// can already publish arbitrary React. A job description is employer-submitted
// text once PLAN-PHASE2.md's employer dashboard ships — an untrusted author
// with no commit access — and the transform is hand-rolled regexes with no
// library default to fall back on.
//
// Asserted against the component's own parseMarkdown, never a copy of the
// regexes: a test that reimplements the pipeline stays green while the
// component regresses.
//
// No database, no env, no network.
import { parseMarkdown } from '../components/MarkdownContent';

let failures = 0;

function check(name: string, ok: boolean, detail?: string): void {
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok && detail) console.log(`        ${detail}`);
}

function main() {
  // -------------------------------------------------------------------------
  // 1. Raw HTML is escaped, never executable.
  // -------------------------------------------------------------------------
  const html = parseMarkdown(
    'Hola <script>alert(1)</script> y <img src=x onerror=alert(2)>\n\n<div onclick="evil()">bloque</div>',
  );

  check('no <script> tag survives job markdown rendering', !/<script/i.test(html), html);
  check('no <img> tag survives job markdown rendering', !/<img/i.test(html), html);
  // Inside a REAL tag. A bare /\son\w+=/ also matches `onclick=&quot;` sitting
  // harmlessly in escaped text, which is the outcome we want, not a failure.
  check('no event handler survives inside a tag', !/<[a-z][^>]*\son\w+\s*=/i.test(html), html);
  check('no raw <div> survives', !/<div/i.test(html), html);
  check(
    'the escaped text is still visible to the employer',
    html.includes('&lt;script&gt;'),
    'Raw HTML should be escaped, not dropped — a silently vanished paste is a bug report.',
  );

  // A closing tag alone is enough to break out of the surrounding markup, and
  // `javascript:` in an attribute is the payload that survives a naive
  // "strip < and >" fix. Neither can reach the DOM as markup once escaped.
  check(
    'a bare closing tag is escaped',
    parseMarkdown('fin </p><script>alert(1)</script>').includes('&lt;/p&gt;'),
  );
  check(
    'attribute quotes are escaped',
    parseMarkdown('<a href="javascript:alert(1)">x</a>').includes('&quot;'),
  );

  // -------------------------------------------------------------------------
  // 2. Escaping runs BEFORE the transforms, so the transforms still work.
  // -------------------------------------------------------------------------
  // Escaping the OUTPUT instead would turn every tag this file generates into
  // literal text — green on the assertions above, and the job page renders
  // `<strong>` as words. Both halves have to be asserted together.
  const formatted = parseMarkdown(
    '## Requisitos\n\n- **Excluyente:** experiencia\n- *Deseable:* inglés',
  );
  check('H2 headings still render', formatted.includes('<h2>Requisitos</h2>'), formatted);
  check('bold still renders', formatted.includes('<strong>Excluyente:</strong>'), formatted);
  check('italic still renders', formatted.includes('<em>Deseable:</em>'), formatted);
  check('bullet lists still render', /<ul><li>/.test(formatted), formatted);

  // Separate fixture, not an extra block on the one above: the <ul> wrapper
  // consumes the newline that ends the list, so a paragraph following a list
  // never gets its own block. Pre-existing behaviour of the transforms, left
  // alone here — this file is about the escape, not the markdown.
  const paragraphs = parseMarkdown('Texto normal.\n\nSegundo párrafo.');
  check('paragraphs still render', paragraphs.includes('<p>Texto normal.</p>'), paragraphs);
  check('line breaks still render', parseMarkdown('a\nb').includes('a<br/>b'));

  // -------------------------------------------------------------------------
  // 3. Escaping and the markdown regexes do not corrupt each other.
  // -------------------------------------------------------------------------
  // `&` is escaped first; nothing downstream touches `&`, so an entity must
  // never come out double-encoded.
  const amp = parseMarkdown('Ventas & Marketing');
  check('& is escaped exactly once', amp.includes('&amp; Marketing') && !amp.includes('&amp;amp;'), amp);

  // The bold/italic regexes run over text that now contains entities. They must
  // match around them, not split one open.
  const entityBold = parseMarkdown('**<b>negrita</b>** y *<i>cursiva</i>*');
  check(
    'bold matches content containing entities',
    entityBold.includes('<strong>&lt;b&gt;negrita&lt;/b&gt;</strong>'),
    entityBold,
  );
  check(
    'italic matches content containing entities',
    entityBold.includes('<em>&lt;i&gt;cursiva&lt;/i&gt;</em>'),
    entityBold,
  );

  // A description that opens with markup can no longer forge this file's own
  // block detection (`block.startsWith('<h')`) or slip a literal <li> past the
  // <ul> wrapper — both read escaped text now, not attacker text.
  const forged = parseMarkdown('<h2 onmouseover="evil()">falso</h2>\n\n<li>suelto</li>');
  check('a forged heading is a paragraph of escaped text', forged.startsWith('<p>&lt;h2'), forged);
  check('a forged <li> is not wrapped in <ul>', !forged.includes('<ul>'), forged);

  console.log('');
  if (failures > 0) {
    console.error(`${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.log('All job markdown assertions passed.');
  process.exit(0);
}

main();
