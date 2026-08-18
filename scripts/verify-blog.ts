// Asserts the properties of the blog read path that are easy to believe and
// wrong (PLAN-PHASE3-DRAFT.md §4 points 6 and 7, §11).
//
//   1. `marked` passes raw HTML through VERBATIM by default and has had no
//      `sanitize` option since v5. lib/blog.ts overrides the `html` renderer to
//      escape it, and the article body goes to dangerouslySetInnerHTML — so
//      "is raw HTML still escaped?" is a question about a dependency's default,
//      which is exactly the kind of thing a minor version bump changes under
//      you. It also got sharper on 2026-08-12: bodies now arrive over HTTP from
//      an admin session rather than from a file committed to this repo.
//   2. A slug is rejected before it reaches a query, not after.
//   3. Draft posts cannot leak. Under Väg A a draft was a file the reader
//      skipped; now it is a row one forgotten WHERE clause away from being
//      public, so the single-predicate rule is asserted by reading the source —
//      the same technique as verify-candidate-access.ts, and for the same
//      reason: the property is about what the file may contain, and a runtime
//      check only covers the paths someone remembered to call.
//
// No database, no env, no network — it runs in CI, where neither exists. When
// DATABASE_URL *is* set, section 4 additionally walks the real articles.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getBlogPost, getBlogPosts, getBlogSlugs, renderMarkdown } from '../lib/blog';

let failures = 0;

function check(name: string, ok: boolean, detail?: string): void {
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok && detail) console.log(`        ${detail}`);
}

async function main() {
  // -------------------------------------------------------------------------
  // 1. Raw HTML is escaped, never executable.
  // -------------------------------------------------------------------------
  // Through lib/blog.ts's own renderer, never a re-imported copy of `marked`:
  // under tsx's CJS transform a dynamic import of the library resolves to a
  // SECOND instance that never saw marked.use(), which would make this test
  // pass green while the app kept passing raw HTML through. Found the hard way.
  const html = renderMarkdown(
    'Hola <script>alert(1)</script> y <img src=x onerror=alert(2)>\n\n<div onclick="evil()">bloque</div>',
  );

  check('no <script> tag survives markdown rendering', !/<script/i.test(html), html);
  check('no <img> tag survives markdown rendering', !/<img/i.test(html), html);
  check('no event handler survives inside a tag', !/<[a-z][^>]*\son\w+\s*=/i.test(html), html);
  check('no raw <div> survives', !/<div/i.test(html), html);
  check(
    'escaped markup is still visible to the author',
    html.includes('&lt;script&gt;') || html.includes('&lt;div'),
    html,
  );
  check('real markdown still renders', renderMarkdown('**negrita** y `code`').includes('<strong>'));

  // -------------------------------------------------------------------------
  // 1b. A link destination cannot carry a scheme the browser will execute.
  // -------------------------------------------------------------------------
  // The gap section 1 did NOT cover, found in PLAN-PHASE3-DRAFT.md §12.1 and
  // closed by PR B3: the `html` renderer escapes raw tags, but Markdown's own
  // link syntax never passes through it, so `[x](javascript:…)` rendered a
  // live anchor while every assertion above stayed green.
  //
  // Asserted through renderMarkdown() for the same reason as section 1 — a
  // re-imported `marked` is a different instance that never saw marked.use().
  const dangerous = [
    ['javascript: in a link', '[clic](javascript:alert(document.cookie))'],
    ['javascript: in an image', '![x](javascript:alert(1))'],
    ['data:text/html in a link', '[a](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)'],
    ['mixed case scheme', '[JS](JaVaScRiPt:alert(1))'],
    ['leading whitespace before the scheme', '[sp](   javascript:alert(1))'],
    ['vbscript:', '[v](vbscript:msgbox(1))'],
  ] as const;

  for (const [name, markdown] of dangerous) {
    const rendered = renderMarkdown(markdown);
    check(
      `blocked: ${name}`,
      !/(href|src)\s*=/i.test(rendered) && !/javascript:|vbscript:|data:text\/html/i.test(rendered),
      rendered,
    );
  }

  // A rejected destination keeps its text: an editor who pasted something bad
  // must see what happened rather than watch the words disappear.
  check(
    'a rejected link keeps its visible text',
    renderMarkdown('[clic aqui](javascript:alert(1))').includes('clic aqui'),
  );

  // And the allowlist must not have eaten the links articles actually use.
  const allowed = [
    ['https', '[ok](https://example.com)', 'href="https://example.com"'],
    ['http', '[ok](http://example.com)', 'href="http://example.com"'],
    ['mailto', '[mail](mailto:hola@trabajo.com.py)', 'href="mailto:hola@trabajo.com.py"'],
    ['site-relative', '[empleos](/empleos)', 'href="/empleos"'],
    ['anchor', '[seccion](#requisitos)', 'href="#requisitos"'],
    ['image', '![alt](/blog-covers/x.webp)', 'src="/blog-covers/x.webp"'],
  ] as const;

  for (const [name, markdown, expected] of allowed) {
    check(`still works: ${name}`, renderMarkdown(markdown).includes(expected), renderMarkdown(markdown));
  }

  // The override extends marked's renderer rather than replacing it, so the
  // two halves must both be live at once. If a future edit swaps `renderer`
  // for a fresh object, section 1 catches the escape and this catches the rest.
  check(
    'title attributes are escaped, not passed through',
    !renderMarkdown('[x](https://e.com "a\"onmouseover=\"evil()")').includes('onmouseover="evil'),
    renderMarkdown('[x](https://e.com "a\"onmouseover=\"evil()")'),
  );

  // -------------------------------------------------------------------------
  // 2. A junk slug is refused before any query runs.
  // -------------------------------------------------------------------------
  // It no longer becomes a filesystem path, so this is not a traversal guard
  // any more — it is the definition of a URL this site will answer for, and it
  // keeps garbage from reaching the database at all.
  const rejected = ['../../AGENTS', '../../../etc/passwd', './../README', 'sub/dir', 'UPPERCASE', '', '.'];
  for (const slug of rejected) {
    check(`getBlogPost(${JSON.stringify(slug)}) returns null`, (await getBlogPost(slug)) === null);
  }

  // -------------------------------------------------------------------------
  // 3. Drafts cannot leak: one predicate, applied by every public read.
  // -------------------------------------------------------------------------
  const dbBlogSource = readFileSync(join(process.cwd(), 'lib/db/blog.ts'), 'utf8');
  const publicSection = dbBlogSource.slice(
    dbBlogSource.indexOf('// Public reads'),
    dbBlogSource.indexOf('// Admin reads'),
  );

  check(
    'lib/db/blog.ts defines exactly one published predicate',
    (dbBlogSource.match(/function publishedPredicate\(/g) ?? []).length === 1,
  );

  const publicQueries = publicSection.match(/export async function \w+/g) ?? [];
  check('the public section exports at least the three reads', publicQueries.length >= 3, publicQueries.join(', '));

  for (const fn of publicQueries) {
    const name = fn.replace('export async function ', '');
    const body = publicSection.slice(
      publicSection.indexOf(fn),
      publicSection.indexOf('\n}\n', publicSection.indexOf(fn)),
    );
    check(
      `${name}() filters through publishedPredicate()`,
      body.includes('publishedPredicate()'),
      'A public blog read that does not call publishedPredicate() can return a draft. ' +
        'Add the predicate rather than an inline status check — the point is that there is one.',
    );
  }

  check(
    'the public section never selects by id',
    !/eq\(blogPosts\.id/.test(publicSection),
    'A public read keyed on the numeric id would make /blog enumerable by row number.',
  );

  const pageSource = readFileSync(join(process.cwd(), 'app/blog/[slug]/page.tsx'), 'utf8');
  check(
    'the article page reads through lib/blog, not lib/db/blog',
    !/from '@\/lib\/db\/blog'/.test(pageSource),
    'AGENTS.md: blog content is read through lib/blog.ts, which is where the ' +
      'published rule and the markdown escaping both live.',
  );

  // -------------------------------------------------------------------------
  // 4. With a database configured, the real articles too.
  // -------------------------------------------------------------------------
  if (!process.env.DATABASE_URL) {
    console.log('\n(no DATABASE_URL — skipping the article walk, as CI does)');
  } else {
    const posts = await getBlogPosts();
    const slugs = await getBlogSlugs();
    console.log(`\n${posts.length} published article(s)\n`);

    const seen = new Set<string>();
    for (const post of posts) {
      check(`${post.slug}: slug is lowercase/digits/hyphens`, /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug));
      check(`${post.slug}: slug is unique`, !seen.has(post.slug));
      seen.add(post.slug);
      check(`${post.slug}: description fits a meta tag (<=160)`, post.description.length <= 160);
      check(`${post.slug}: has a publication date`, post.publishedAt !== '');
      check(
        `${post.slug}: cover image has alt text`,
        !post.coverUrl || Boolean(post.coverAlt?.trim()),
      );

      const loaded = await getBlogPost(post.slug);
      check(`${post.slug}: loads by slug`, loaded !== null);
      check(`${post.slug}: body rendered to HTML`, Boolean(loaded && loaded.html.trim().length > 0));
      check(`${post.slug}: rendered body has no <script>`, !/<script/i.test(loaded?.html ?? ''));
    }

    check('getBlogSlugs() matches getBlogPosts()', slugs.length === posts.length);
  }

  console.log('');
  if (failures > 0) {
    console.error(`${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.log('All blog assertions passed.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
