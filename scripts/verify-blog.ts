// Asserts lib/blog-sanitize.ts's security properties by running them, same
// spirit as scripts/verify-scoping.ts and scripts/verify-storage.ts.
//
// Väg A's verify-blog.ts (content/blog/*.md, marked's raw-HTML passthrough,
// filesystem slug traversal) is retired along with content/blog/ itself —
// PR 20 replaced the filesystem read path with blogPosts in the database, so
// those properties no longer apply. What replaces them: PLAN-PHASE3-DRAFT.md
// §8.1 found that Väg A's "no sanitizer needed" argument (content is
// git-reviewed Markdown) does not carry to Väg B (content is a POST body from
// an authenticated admin session), which is why lib/blog-sanitize.ts exists.
// This is the mechanical check that it actually does what its header claims.
//
// No database, no env, no network — sanitizeBlogHtml/extractInlineImageKeys
// are pure functions.
import { sanitizeBlogHtml, extractInlineImageKeys } from '../lib/blog-sanitize';

let failures = 0;

function check(name: string, ok: boolean, detail?: string): void {
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok && detail) console.log(`        ${detail}`);
}

function main() {
  // -------------------------------------------------------------------------
  // 1. Script/style/event-handler/iframe content never survives.
  // -------------------------------------------------------------------------
  const dangerous = sanitizeBlogHtml(
    '<p>Hola</p><script>alert(1)</script>' +
      '<img src=x onerror="alert(2)">' +
      '<a href="javascript:alert(3)">click</a>' +
      '<iframe src="https://evil.example"></iframe>' +
      '<div style="background:url(javascript:alert(4))">bloque</div>' +
      '<p onclick="evil()">párrafo</p>',
  );
  check('no <script> survives', !/<script/i.test(dangerous), dangerous);
  check('no <iframe> survives', !/<iframe/i.test(dangerous), dangerous);
  check('no <div> survives (not in ALLOWED_TAGS)', !/<div/i.test(dangerous), dangerous);
  check('no style attribute survives', !/style\s*=/i.test(dangerous), dangerous);
  check('no javascript: URI survives', !/javascript:/i.test(dangerous), dangerous);
  check('no event handler attribute survives', !/\son\w+\s*=/i.test(dangerous), dangerous);
  check('the safe <p>Hola</p> survives', dangerous.includes('<p>Hola</p>'));

  // -------------------------------------------------------------------------
  // 2. What the Tiptap toolbar can actually produce is allowed through.
  // -------------------------------------------------------------------------
  const legit = sanitizeBlogHtml(
    '<h2>Título</h2><p><strong>negrita</strong> y <em>cursiva</em></p>' +
      '<ul><li>uno</li><li>dos</li></ul>' +
      '<blockquote>cita</blockquote>' +
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">enlace</a>' +
      '<img src="/img/blog/0f9e1a2b-3c4d-5e6f-7a8b-9c0d1e2f3a4b.webp" alt="foto" width="800" height="450">',
  );
  check('h2 survives', legit.includes('<h2>Título</h2>'));
  check('strong/em survive', legit.includes('<strong>negrita</strong>') && legit.includes('<em>cursiva</em>'));
  check('list survives', legit.includes('<li>uno</li>'));
  check('blockquote survives', legit.includes('<blockquote>cita</blockquote>'));
  check('link href survives', legit.includes('href="https://example.com"'));
  check('image src/alt/width/height survive', legit.includes('src="/img/blog/'));

  // -------------------------------------------------------------------------
  // 3. Image-key extraction only trusts our own minted keys.
  // -------------------------------------------------------------------------
  const withImages = sanitizeBlogHtml(
    '<img src="/img/blog/0f9e1a2b-3c4d-5e6f-7a8b-9c0d1e2f3a4b.webp" alt="">' +
      '<img src="/img/blog/0f9e1a2b-3c4d-5e6f-7a8b-9c0d1e2f3a4b.webp" alt="dup">' + // duplicate
      '<img src="https://cdn.example.com/img/blog/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.webp" alt="">' + // absolute (R2-shaped)
      '<img src="/img/logos/11111111-2222-3333-4444-555555555555.webp" alt="">' + // wrong namespace for a blog post
      '<img src="https://evil.example/steal.png" alt="">', // not one of ours at all
  );
  const keys = extractInlineImageKeys(withImages);
  check('exactly the two distinct legitimate keys are extracted', keys.length === 2, JSON.stringify(keys));
  check(
    'the relative blog key is extracted',
    keys.includes('img/blog/0f9e1a2b-3c4d-5e6f-7a8b-9c0d1e2f3a4b.webp'),
    JSON.stringify(keys),
  );
  check(
    'the absolute (R2-shaped) key is extracted by its path suffix',
    keys.includes('img/blog/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.webp'),
    JSON.stringify(keys),
  );
  check(
    'a foreign URL contributes no key',
    !keys.some((k) => k.includes('evil')),
    JSON.stringify(keys),
  );

  console.log('');
  if (failures > 0) {
    console.error(`${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.log('All blog assertions passed.');
  process.exit(0);
}

main();
