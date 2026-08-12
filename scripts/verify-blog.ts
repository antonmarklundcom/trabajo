// Asserts the properties of the blog module that are easy to believe and
// wrong, the same discipline as before the Väg B migration
// (PLAN-PHASE3-DRAFT.md §4 points 6/7, batch K) plus what the admin CRUD
// and SEO builds added: cover-alt enforcement, slug immutability,
// draft-preview gating, and that the JSON-LD builders actually parse and
// carry the required fields.
//
// Deliberately still no database, no env, no network — same reasoning as the
// original script had for the file-based blog: this has to run fast and
// deterministically in CI. Now that content lives in blog_posts instead of
// content/blog/*.md, that means testing the PURE functions (rendering,
// validation, JSON-LD) against synthetic fixtures rather than reading real
// rows — the actual DB-backed CRUD (create/update/delete, the real
// draft-404-for-anonymous / renders-for-editor route behaviour) needs
// DATABASE_URL and is out of this script's reach, same limitation
// scripts/verify-scoping.ts already has. Exercise that against a real
// database with `npm run db:verify` reachable, not here.
import {
  buildBlogBreadcrumbJsonLd,
  buildBlogPostingJsonLd,
  canPreviewDraft,
  isSlugChangeAllowed,
  renderMarkdown,
  SLUG_PATTERN,
  validateCoverAlt,
  type BlogPost,
} from '../lib/blog';

let failures = 0;

function check(name: string, ok: boolean, detail?: string): void {
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok && detail) console.log(`        ${detail}`);
}

const FIXTURE_POST: BlogPost = {
  slug: 'articulo-de-prueba',
  title: 'Artículo de prueba',
  description: 'Descripción de prueba para el artículo.',
  category: 'noticias',
  publishedAt: '2026-08-12T10:00:00.000Z',
  updatedAt: '2026-08-13T09:00:00.000Z',
  status: 'published',
  coverUrl: null,
  coverAlt: null,
  coverWidth: null,
  coverHeight: null,
  relatedCategory: undefined,
  relatedCity: undefined,
  html: '<p>Cuerpo de prueba.</p>',
};

function main(): void {
  // -------------------------------------------------------------------------
  // 1. Raw HTML is escaped, never executable. Unchanged from Väg A — the
  //    admin textarea is the input now, but the same author-controlled-input
  //    reasoning applies (an admin/editor account is not automatically a
  //    trusted-with-arbitrary-HTML account).
  // -------------------------------------------------------------------------
  const html = renderMarkdown(
    'Hola <script>alert(1)</script> y <img src=x onerror=alert(2)>\n\n<div onclick="evil()">bloque</div>',
  );

  check('no <script> tag survives markdown rendering', !/<script/i.test(html), html);
  check('no <img> tag survives markdown rendering', !/<img/i.test(html), html);
  check('no event handler survives inside a tag', !/<[a-z][^>]*\son\w+\s*=/i.test(html), html);
  check('no raw <div> survives', !/<div/i.test(html), html);
  check(
    'the escaped text is still visible to the author',
    html.includes('&lt;script&gt;'),
    'Raw HTML should be escaped, not dropped — a silently vanished paste is a bug report.',
  );
  check('real markdown still renders', renderMarkdown('**negrita** y `code`').includes('<strong>'));

  // -------------------------------------------------------------------------
  // 2. Slug shape.
  // -------------------------------------------------------------------------
  const validSlugs = ['como-escribir-un-cv', 'noticia1', 'a'];
  const invalidSlugs = ['../../AGENTS', 'UPPERCASE', 'con espacio', '', '.', 'trailing-'];
  for (const slug of validSlugs) {
    check(`SLUG_PATTERN accepts "${slug}"`, SLUG_PATTERN.test(slug));
  }
  for (const slug of invalidSlugs) {
    check(`SLUG_PATTERN rejects "${slug}"`, !SLUG_PATTERN.test(slug));
  }

  // -------------------------------------------------------------------------
  // 3. A cover with a blank alt is rejected server-side (not just the form).
  // -------------------------------------------------------------------------
  check('no cover, no alt required', validateCoverAlt(null, null));
  check('cover set, real alt: accepted', validateCoverAlt('img/blog/x.webp', 'Trabajadores en una oficina'));
  check('cover set, empty alt: rejected', !validateCoverAlt('img/blog/x.webp', ''));
  check('cover set, whitespace-only alt: rejected', !validateCoverAlt('img/blog/x.webp', '   '));
  check('cover set, null alt: rejected', !validateCoverAlt('img/blog/x.webp', null));

  // -------------------------------------------------------------------------
  // 4. A published slug cannot be changed (§12.5, owner-confirmed — a hard
  //    block, not a confirm-and-proceed like jobs).
  // -------------------------------------------------------------------------
  check(
    'never-published post: slug change allowed',
    isSlugChangeAllowed(false, 'viejo-slug', 'nuevo-slug'),
  );
  check(
    'currently published post: slug change rejected',
    !isSlugChangeAllowed(true, 'viejo-slug', 'nuevo-slug'),
  );
  check(
    'unpublished-back-to-draft post: slug change still rejected (URL was live once)',
    !isSlugChangeAllowed(true, 'viejo-slug', 'nuevo-slug'),
  );
  check(
    'unchanged slug is always a no-op, even on a published post',
    isSlugChangeAllowed(true, 'mismo-slug', 'mismo-slug'),
  );

  // -------------------------------------------------------------------------
  // 5. Draft preview: deny by default. A draft is visible at its real URL
  //    only to admin/editor — every other role, including an authenticated
  //    one, gets treated as "not found" by app/blog/[slug]/page.tsx.
  // -------------------------------------------------------------------------
  check('anonymous (no session): cannot preview a draft', !canPreviewDraft(null));
  check('employer: cannot preview a draft', !canPreviewDraft('employer'));
  check('admin: can preview a draft', canPreviewDraft('admin'));
  check('editor: can preview a draft', canPreviewDraft('editor'));

  // -------------------------------------------------------------------------
  // 6. Article JSON-LD parses and carries the required fields.
  // -------------------------------------------------------------------------
  const siteUrl = 'https://trabajo.com.py';
  const jsonLd = buildBlogPostingJsonLd(FIXTURE_POST, siteUrl);
  const jsonLdRoundTrip = JSON.parse(JSON.stringify(jsonLd));

  check('BlogPosting JSON-LD parses', typeof jsonLdRoundTrip === 'object' && jsonLdRoundTrip !== null);
  check('BlogPosting @type is correct', jsonLdRoundTrip['@type'] === 'BlogPosting');
  check('BlogPosting has headline', jsonLdRoundTrip.headline === FIXTURE_POST.title);
  check('BlogPosting has description', jsonLdRoundTrip.description === FIXTURE_POST.description);
  check('BlogPosting has datePublished', jsonLdRoundTrip.datePublished === FIXTURE_POST.publishedAt);
  check('BlogPosting has dateModified', jsonLdRoundTrip.dateModified === FIXTURE_POST.updatedAt);
  check('BlogPosting has author', jsonLdRoundTrip.author?.['@type'] === 'Organization');
  check(
    'BlogPosting has mainEntityOfPage pointing at the article URL',
    jsonLdRoundTrip.mainEntityOfPage?.['@id'] === `${siteUrl}/blog/${FIXTURE_POST.slug}`,
  );
  check(
    'BlogPosting falls back to the generated OG image when there is no cover',
    jsonLdRoundTrip.image === `${siteUrl}/blog/${FIXTURE_POST.slug}/opengraph-image`,
  );

  const withCover: BlogPost = { ...FIXTURE_POST, coverUrl: '/img/blog/abc.webp' };
  const jsonLdWithCover = buildBlogPostingJsonLd(withCover, siteUrl);
  check('BlogPosting uses the real cover when one is set', jsonLdWithCover.image === '/img/blog/abc.webp');

  const breadcrumb = JSON.parse(JSON.stringify(buildBlogBreadcrumbJsonLd(FIXTURE_POST, siteUrl)));
  check('BreadcrumbList parses and has 3 items', breadcrumb.itemListElement?.length === 3);
  check(
    'BreadcrumbList reads Inicio > Blog > title',
    breadcrumb.itemListElement[0].name === 'Inicio' &&
      breadcrumb.itemListElement[1].name === 'Blog' &&
      breadcrumb.itemListElement[2].name === FIXTURE_POST.title,
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
