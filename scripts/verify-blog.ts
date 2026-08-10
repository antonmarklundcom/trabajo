// Asserts the two properties of lib/blog.ts that are easy to believe and wrong
// (PLAN-PHASE3-DRAFT.md §4 points 6 and 7, the batch K review).
//
// Both exist because the intuition about them does not match the library:
//
//   1. `marked` passes raw HTML through VERBATIM by default and has had no
//      `sanitize` option since v5. lib/blog.ts overrides the `html` renderer to
//      escape it, and the article body goes to dangerouslySetInnerHTML — so
//      "is raw HTML still escaped?" is a question about a dependency's default,
//      which is exactly the kind of thing a minor version bump changes under
//      you. Asserted here rather than remembered.
//   2. A slug becomes a filesystem path. `../../AGENTS` must not read a file.
//
// Every article in content/blog/ is also parsed, so a broken frontmatter block
// fails CI instead of failing the page for a visitor.
//
// No database, no env, no network.
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
  // Inside a REAL tag. A bare /\son\w+=/ also matches `onclick=&quot;` sitting
  // harmlessly in escaped text, which is the outcome we want, not a failure.
  check('no event handler survives inside a tag', !/<[a-z][^>]*\son\w+\s*=/i.test(html), html);
  check('no raw <div> survives', !/<div/i.test(html), html);
  check(
    'the escaped text is still visible to the author',
    html.includes('&lt;script&gt;'),
    'Raw HTML should be escaped, not dropped — a silently vanished paste is a bug report.',
  );
  check('real markdown still renders', renderMarkdown('**negrita** y `code`').includes('<strong>'));

  // -------------------------------------------------------------------------
  // 2. A slug cannot leave content/blog/.
  // -------------------------------------------------------------------------
  const traversals = [
    '../../AGENTS',
    '../../package',
    '../../../etc/passwd',
    './../README',
    'sub/dir',
    'UPPERCASE',
    '',
    '.',
  ];
  for (const slug of traversals) {
    const post = await getBlogPost(slug);
    check(`getBlogPost(${JSON.stringify(slug)}) returns null`, post === null);
  }

  // -------------------------------------------------------------------------
  // 3. Every committed article parses, and its slug is a usable SEO URL.
  // -------------------------------------------------------------------------
  const posts = await getBlogPosts();
  const slugs = await getBlogSlugs();
  console.log(`\n${posts.length} published article(s) in content/blog/\n`);

  const seen = new Set<string>();
  for (const post of posts) {
    check(`${post.slug}: slug is lowercase/digits/hyphens`, /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug));
    check(`${post.slug}: slug is unique`, !seen.has(post.slug));
    seen.add(post.slug);
    check(`${post.slug}: description fits a meta tag (<=160)`, post.description.length <= 160);

    const loaded = await getBlogPost(post.slug);
    check(`${post.slug}: loads by slug`, loaded !== null);
    check(`${post.slug}: body rendered to HTML`, Boolean(loaded && loaded.html.trim().length > 0));
    check(`${post.slug}: rendered body has no <script>`, !/<script/i.test(loaded?.html ?? ''));
  }

  check('getBlogSlugs() matches getBlogPosts()', slugs.length === posts.length);

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
