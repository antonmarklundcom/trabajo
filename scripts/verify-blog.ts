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
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { getBlogPost, getBlogPosts, getBlogSlugs, renderArticle, renderMarkdown } from '../lib/blog';
import {
  BLOG_CATEGORIES,
  BLOG_CATEGORY_LABELS,
  BLOG_CATEGORY_COPY,
  blogCategoryPath,
  isBlogCategory,
  isReservedBlogSlug,
} from '../lib/blog-categories';
import { blogCategoryEnum } from '../lib/db/schema';
import { paraguayToday, shouldMintRedirect } from '../lib/db/blog';
import { blogArchiveRobots, blogArchivesForSitemap, blogListingCanonical } from '../lib/seo';
import { parsePageParam } from '../lib/pagination';
import { readingMinutes, seoChecklist, wordCount } from '../lib/blog-editor';
import { blogPostSchema, unknownRelatedTaxonomy } from '../app/api/admin/blog/schema';
import { checkDraftBodyRules, checkDrafts } from './blog-drafts';

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
  // 1b. Link and image destinations are scheme-allowlisted (B3).
  // -------------------------------------------------------------------------
  // The escape above closes `<script>`. It does nothing about a link
  // DESTINATION, which is not HTML but a Markdown token the renderer turns into
  // an href — so `[x](javascript:alert(1))` was a live anchor with the escape
  // fully in place (PLAN-PHASE3-DRAFT.md §12.1).
  //
  // These run through the same renderMarkdown() for the same reason as §1, and
  // they sit next to the escape assertions on purpose: both properties live in
  // one marked.use() call, and an override that replaced that object instead of
  // extending it would switch the escape off silently (§13.4 B3).
  const blockedLinks = [
    ['javascript:', '[x](javascript:alert(1))'],
    ['JavaScript: with capitals', '[x](JavaScript:alert(1))'],
    ['data:text/html', '[x](data:text/html,<script>alert(1)</script>)'],
    ['vbscript:', '[x](vbscript:msgbox("x"))'],
    ['file:', '[x](file:///etc/passwd)'],
  ] as const;

  for (const [label, markdown] of blockedLinks) {
    const rendered = renderMarkdown(markdown);
    check(`${label} does not become an anchor`, !/<a\s/i.test(rendered), rendered);
    check(`${label} link text survives as visible text`, rendered.includes('x'), rendered);
  }

  const blockedImages = [
    ['javascript: image', '![alt](javascript:alert(1))'],
    ['data: image payload', '![alt](data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=)'],
  ] as const;

  for (const [label, markdown] of blockedImages) {
    const rendered = renderMarkdown(markdown);
    check(`${label} does not become an img`, !/<img/i.test(rendered), rendered);
    check(`${label} alt text survives`, rendered.includes('alt'), rendered);
  }

  // The allowlist has to still allow the things articles actually use, or the
  // fix is a different kind of breakage.
  check(
    'https links still render',
    /<a href="https:\/\/example\.com"/.test(renderMarkdown('[x](https://example.com)')),
    renderMarkdown('[x](https://example.com)'),
  );
  check(
    'relative links still render',
    /<a href="\/empleos"/.test(renderMarkdown('[x](/empleos)')),
    renderMarkdown('[x](/empleos)'),
  );
  check(
    'fragment links still render',
    /<a href="#seccion"/.test(renderMarkdown('[x](#seccion)')),
    renderMarkdown('[x](#seccion)'),
  );
  check(
    'mailto links still render',
    /<a href="mailto:hola@trabajo\.com\.py"/.test(renderMarkdown('[x](mailto:hola@trabajo.com.py)')),
    renderMarkdown('[x](mailto:hola@trabajo.com.py)'),
  );
  check(
    'https images still render',
    /<img src="https:\/\/example\.com\/a\.png"/.test(renderMarkdown('![alt](https://example.com/a.png)')),
    renderMarkdown('![alt](https://example.com/a.png)'),
  );
  check(
    'a title attribute cannot break out of the tag',
    !/<a [^>]*title="[^"]*"[^>]*"/.test(renderMarkdown('[x](https://e.com "a\"b")')),
    renderMarkdown('[x](https://e.com "a\"b")'),
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
  // Named, not counted: the loop below proves every public export calls the
  // predicate, and this proves the C2 reads are among the exports it walked —
  // a read moved below the "Admin reads" divider would otherwise escape both.
  const EXPECTED_PUBLIC_READS = [
    'queryPublishedPosts',
    'queryPublishedPostPage',
    'queryPublishedCategoryCounts',
    'queryRelatedPosts',
    'queryPostsForJobCategory',
    'queryPublishedPost',
    'queryRedirectTarget',
  ];
  const publicNames = publicQueries.map((fn) => fn.replace('export async function ', ''));
  const missingReads = EXPECTED_PUBLIC_READS.filter((name) => !publicNames.includes(name));
  check(
    'every public read (incl. the C2 archive, related and linking reads) is in the public section',
    missingReads.length === 0,
    `missing from the public section: ${missingReads.join(', ')}`,
  );

  // Scheduled publishing (C3): a published post dated in the future is not
  // public yet. The bound lives inside the one predicate, so every read above
  // inherits it — and the write path stamps the same clock it compares to.
  const predicateBody = dbBlogSource.slice(
    dbBlogSource.indexOf('function publishedPredicate('),
    dbBlogSource.indexOf('\n}\n', dbBlogSource.indexOf('function publishedPredicate(')),
  );
  check(
    'publishedPredicate() hides a post dated after today (scheduled publishing)',
    /lte\(blogPosts\.publishedAt,\s*paraguayToday\(\)\)/.test(predicateBody),
    'Without the bound, a post saved as published with a future date is public at once, dated in the future.',
  );
  const normalizeBody = dbBlogSource.slice(
    dbBlogSource.indexOf('function normalizePublishedAt('),
    dbBlogSource.indexOf('\n}\n', dbBlogSource.indexOf('function normalizePublishedAt(')),
  );
  check(
    'the write path stamps paraguayToday(), the clock the predicate compares to',
    normalizeBody.includes('paraguayToday()') && !normalizeBody.includes('toISOString'),
    'A UTC stamp against a Paraguayan predicate hides a post published after 21:00 until the next day.',
  );
  check(
    'paraguayToday() is the Paraguayan date, not the UTC one',
    paraguayToday(new Date('2026-09-28T01:30:00Z')) === '2026-09-27' &&
      paraguayToday(new Date('2026-09-28T12:00:00Z')) === '2026-09-28',
    `${paraguayToday(new Date('2026-09-28T01:30:00Z'))} / ${paraguayToday(new Date('2026-09-28T12:00:00Z'))}`,
  );

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

  // Checking only app/blog/[slug]/page.tsx proves that one file is clean, not
  // that every public consumer is — app/blog/page.tsx (the listing),
  // app/blog/[slug]/opengraph-image.tsx and app/sitemap.ts all read blog
  // content too, and any of them importing lib/db/blog directly would bypass
  // publishedPredicate() the same way. Admin routes are exempt: they are
  // meant to read unpublished posts, which is the whole point of the admin
  // reads existing as a separate section of lib/db/blog.ts.
  {
    const SKIP_DIRS = new Set(['node_modules', '.next']);
    const EXEMPT_PREFIXES = ['app/admin/', 'app/api/admin/'];
    const EXEMPT_FILES = new Set(['lib/blog.ts']); // the seam itself

    function walkPublic(dir: string): string[] {
      const out: string[] = [];
      for (const entry of readdirSync(join(process.cwd(), dir))) {
        if (SKIP_DIRS.has(entry)) continue;
        const rel = `${dir}/${entry}`;
        if (statSync(join(process.cwd(), rel)).isDirectory()) out.push(...walkPublic(rel));
        else if (rel.endsWith('.ts') || rel.endsWith('.tsx')) out.push(rel);
      }
      return out;
    }

    const candidates = ['app', 'components']
      .flatMap(walkPublic)
      .filter(
        (f) => !EXEMPT_PREFIXES.some((prefix) => f.startsWith(prefix)) && !EXEMPT_FILES.has(f),
      );

    const offenders = candidates.filter((f) =>
      /from '@\/lib\/db\/blog'/.test(readFileSync(join(process.cwd(), f), 'utf8')),
    );

    check(
      'every public consumer reads through lib/blog, not lib/db/blog',
      offenders.length === 0,
      `Found: ${offenders.join(', ') || 'none'}. AGENTS.md: blog content is read through ` +
        'lib/blog.ts, which is where the published rule and the markdown escaping both live.',
    );
  }

  // -------------------------------------------------------------------------
  // 3b. Categories have exactly one source (C1, PLAN-GROWTH.md §4).
  // -------------------------------------------------------------------------
  // Before lib/blog-categories.ts existed, lib/db/schema.ts, lib/blog.ts and
  // BlogPostForm.tsx each hardcoded the same array of category slugs — three
  // chances for one of them to drift when a category is added. This walks the
  // same directories scripts/verify-whatsapp.ts does, looking for the two
  // slugs every one of those three copies wrote adjacently, and asserts the
  // pattern survives in exactly the one file meant to have it.
  const SCAN_DIRS = ['app', 'components', 'lib'];
  const SKIP_DIRS = new Set(['node_modules', '.next']);

  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(join(process.cwd(), dir))) {
      if (SKIP_DIRS.has(entry)) continue;
      const rel = `${dir}/${entry}`;
      if (statSync(join(process.cwd(), rel)).isDirectory()) out.push(...walk(rel));
      else if (rel.endsWith('.ts') || rel.endsWith('.tsx')) out.push(rel);
    }
    return out;
  }

  const sourceFiles = SCAN_DIRS.flatMap(walk);
  const adjacentSlugsRe = /['"]noticias['"]\s*,\s*['"]analisis-laboral['"]/;
  const filesWithTheArray = sourceFiles.filter((f) =>
    adjacentSlugsRe.test(readFileSync(join(process.cwd(), f), 'utf8')),
  );

  check(
    'exactly one array literal of category slugs exists (lib/blog-categories.ts)',
    filesWithTheArray.length === 1 && filesWithTheArray[0] === 'lib/blog-categories.ts',
    `found in: ${filesWithTheArray.join(', ') || '(nowhere)'}`,
  );

  check(
    'BLOG_CATEGORIES has all seven categories (§7 D4)',
    BLOG_CATEGORIES.length === 7,
    BLOG_CATEGORIES.join(', '),
  );
  check(
    'every category has a label',
    BLOG_CATEGORIES.every((c) => typeof BLOG_CATEGORY_LABELS[c] === 'string' && BLOG_CATEGORY_LABELS[c].length > 0),
  );
  check(
    'every category has archive copy (title/description/intro)',
    BLOG_CATEGORIES.every((c) => {
      const copy = BLOG_CATEGORY_COPY[c];
      return Boolean(copy?.title && copy.description && copy.intro);
    }),
  );
  check(
    'analisis-laboral kept its stored value — only its label changed',
    BLOG_CATEGORIES.includes('analisis-laboral') && BLOG_CATEGORY_LABELS['analisis-laboral'] === 'Mercado laboral',
  );
  check(
    "the database enum is the same tuple as BLOG_CATEGORIES, not a copy",
    (blogCategoryEnum as readonly string[]) === (BLOG_CATEGORIES as readonly string[]),
  );

  // -------------------------------------------------------------------------
  // 3c. Heading ids (C2) without reopening the escape.
  // -------------------------------------------------------------------------
  // The heading renderer sits in the same marked.use() object as the escape
  // and the link allowlist. These prove it adds ids AND that §1's properties
  // still hold for markup inside a heading.
  {
    const rendered = renderArticle('## Hola mundo\n\ntexto\n\n## Hola mundo\n\n### Detalle **fino**');
    check(
      'an h2 gets a slugified id',
      rendered.html.includes('<h2 id="hola-mundo">Hola mundo</h2>'),
      rendered.html,
    );
    check('a repeated heading gets a unique id', rendered.html.includes('<h2 id="hola-mundo-2">'), rendered.html);
    check('an h3 gets an id too', rendered.html.includes('<h3 id="detalle-fino">'), rendered.html);
    check(
      'renderArticle() lists the h2s, in order, with their ids',
      JSON.stringify(rendered.headings) ===
        JSON.stringify([
          { id: 'hola-mundo', text: 'Hola mundo' },
          { id: 'hola-mundo-2', text: 'Hola mundo' },
        ]),
      JSON.stringify(rendered.headings),
    );
    const hostile = renderMarkdown('## Hola <script>alert(1)</script> "x" onmouseover=y');
    check('raw HTML inside a heading is still escaped', !/<script/i.test(hostile), hostile);
    check(
      'a heading id is [a-z0-9-] only — nothing can break out of the attribute',
      /<h2 id="[a-z0-9-]+">/.test(hostile) && !/id="[^"]*[^a-z0-9-"][^"]*"/.test(hostile),
      hostile,
    );
    check(
      'state does not leak between renders (ids restart per article)',
      renderMarkdown('## Hola mundo').includes('id="hola-mundo"'),
    );
  }

  // -------------------------------------------------------------------------
  // 3d. Archives and pagination (C2): the indexing rules.
  // -------------------------------------------------------------------------
  check('an empty category archive is noindex', blogArchiveRobots(0).index === false);
  check('a category archive with a post is indexable', blogArchiveRobots(1).index === true);
  check('an archive is always follow', blogArchiveRobots(0).follow === true && blogArchiveRobots(5).follow === true);
  check(
    'the sitemap lists exactly the non-empty archives',
    JSON.stringify(
      blogArchivesForSitemap([
        { category: 'noticias', total: 0 },
        { category: 'consejos-cv', total: 3 },
        { category: 'entrevistas', total: 1 },
      ]),
    ) === JSON.stringify(['consejos-cv', 'entrevistas']),
  );
  check('page 1 canonicalises to the bare URL', blogListingCanonical('/blog', 1) === '/blog');
  check('page N is self-canonical', blogListingCanonical('/blog/categoria/entrevistas', 3) === '/blog/categoria/entrevistas?page=3');
  check(
    'only a plain positive integer is a page number',
    parsePageParam('2') === 2 &&
      parsePageParam(undefined) === 1 &&
      parsePageParam('0') === 1 &&
      parsePageParam('abc') === 1 &&
      parsePageParam('2.5') === 1 &&
      parsePageParam('-3') === 1 &&
      parsePageParam('1e3') === 1 &&
      parsePageParam(['4', '5']) === 4,
  );
  check('the archive path is /blog/categoria/{slug}', blogCategoryPath('consejos-cv') === '/blog/categoria/consejos-cv');
  check('an unknown category is not a category', !isBlogCategory('no-existe') && isBlogCategory('entrevistas'));
  check("a post can never take the archive segment as its slug", isReservedBlogSlug('categoria'));
  check(
    'blogSlugExists() treats the reserved segment as taken',
    /blogSlugExists[\s\S]*?isReservedBlogSlug\(slug\)/.test(dbBlogSource),
  );

  // The rules above are only true of the site if the pages use them.
  {
    const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8');
    const archive = read('app/blog/categoria/[categoria]/page.tsx');
    const index = read('app/blog/page.tsx');
    const sitemap = read('app/sitemap.ts');

    check('the archive takes its robots from blogArchiveRobots()', /robots:\s*blogArchiveRobots\(/.test(archive));
    check('the archive 404s an unknown category', /!isBlogCategory\(categoria\)\)\s*notFound\(\)/.test(archive));
    for (const [name, src] of [['/blog', index], ['the archive', archive]] as const) {
      check(`${name} 404s a page past the last one`, /page > totalPages\)\s*notFound\(\)/.test(src));
      check(`${name} takes its canonical from blogListingCanonical()`, src.includes('canonicalFor(blogListingCanonical('));
      check(`${name} only renders pagination through <Pagination>`, src.includes('<Pagination') && src.includes('totalPages={totalPages}'));
    }
    check(
      'the sitemap lists archives through blogArchivesForSitemap()',
      /blogArchivesForSitemap\(blogCategoryCounts\)/.test(sitemap),
    );

    // -----------------------------------------------------------------------
    // 3e. JSON-LD goes through components/JsonLd.tsx, and only there.
    // -----------------------------------------------------------------------
    // lib/json-ld.ts escapes `</script>` in the payload; a hand-rolled
    // <script type="application/ld+json"> with JSON.stringify would not, and
    // a post title is admin-typed text.
    const withRawJsonLd = [...['app', 'components'].flatMap(walk)].filter(
      (f) => f !== 'components/JsonLd.tsx' && read(f).includes('application/ld+json'),
    );
    check(
      'no file but components/JsonLd.tsx writes a JSON-LD <script>',
      withRawJsonLd.length === 0,
      `found in: ${withRawJsonLd.join(', ')}`,
    );
    for (const [name, src] of [
      ['/blog', index],
      ['the archive', archive],
      ['the article', read('app/blog/[slug]/page.tsx')],
    ] as const) {
      check(`${name} renders its structured data through <JsonLd>`, src.includes("import JsonLd from '@/components/JsonLd'") && src.includes('<JsonLd data={breadcrumbJsonLd} />'));
    }
    check(
      'the archive declares BreadcrumbList and ItemList',
      archive.includes("'@type': 'BreadcrumbList'") && archive.includes("'@type': 'ItemList'"),
    );

    // -----------------------------------------------------------------------
    // 3f. Every page that embeds posts is refreshed by an article write.
    // -----------------------------------------------------------------------
    // The blog-side twin of cachekey:verify's job-page scan. Since C2 posts
    // appear on job and landing pages; a page missing from BLOG_PATHS keeps
    // showing an unpublished article until its own timer runs out.
    const cacheSource = read('lib/cache.ts');
    const listStart = cacheSource.indexOf('const BLOG_PATHS');
    const listed = new Set(
      [...cacheSource.slice(listStart, cacheSource.indexOf('];', listStart)).matchAll(/\['([^']+)'/g)].map((m) => m[1]),
    );
    const BLOG_READS = /\b(getBlogPosts|getBlogPost|getBlogSlugs|getBlogPostPage|getBlogCategoryCounts|getRelatedPosts|getLatestBlogPosts|getPostsForJobCategory)\b/;
    const routeFiles = walk('app').filter(
      (f) =>
        (f.endsWith('/page.tsx') || f === 'app/sitemap.ts') &&
        !f.startsWith('app/admin') &&
        !f.startsWith('app/empresa/') &&
        !f.startsWith('app/postulante'),
    );
    let blogPages = 0;
    for (const file of routeFiles) {
      const imported = read(file).match(/import\s*\{([^}]*)\}\s*from\s*'@\/lib\/blog'/);
      if (!imported || !BLOG_READS.test(imported[1])) continue;
      blogPages += 1;
      const route =
        file === 'app/sitemap.ts'
          ? '/sitemap.xml'
          : '/' +
            file
              .replace(/^app\//, '')
              .replace(/\/?page\.tsx$/, '')
              .split('/')
              .filter((seg) => seg && !/^\(.*\)$/.test(seg))
              .join('/');
      check(`${route} is in lib/cache.ts BLOG_PATHS`, listed.has(route), `${file} reads blog posts but an article write never refreshes it`);
    }
    check(`the scan found the blog-reading pages (${blogPages})`, blogPages >= 10);
  }

  // -------------------------------------------------------------------------
  // 3g. Admin rules (C3).
  // -------------------------------------------------------------------------
  const basePayload = {
    title: 'Cómo conseguir trabajo en ventas en Paraguay',
    description: 'Qué buscan los empleadores de ventas en Paraguay y cómo preparar tu postulación para destacar.',
    body: 'x'.repeat(60),
    status: 'draft',
  };
  check(
    'a sector guide without a job category is rejected server-side',
    !blogPostSchema.safeParse({ ...basePayload, category: 'guias-por-sector', relatedCategory: '' }).success,
  );
  check(
    'a sector guide with a job category is accepted',
    blogPostSchema.safeParse({ ...basePayload, category: 'guias-por-sector', relatedCategory: 'ventas' }).success,
  );
  check(
    'other categories still accept no job category',
    blogPostSchema.safeParse({ ...basePayload, category: 'consejos-cv', relatedCategory: null }).success,
  );
  const taxonomy = { categories: [{ slug: 'ventas' }], cities: [{ slug: 'asuncion' }] };
  check(
    'related slugs are checked against the taxonomy, not just their shape',
    unknownRelatedTaxonomy({ relatedCategory: 'ventaz', relatedCity: null }, taxonomy) !== null &&
      unknownRelatedTaxonomy({ relatedCategory: 'ventas', relatedCity: 'luqe' }, taxonomy) !== null &&
      unknownRelatedTaxonomy({ relatedCategory: 'ventas', relatedCity: 'asuncion' }, taxonomy) === null &&
      unknownRelatedTaxonomy({ relatedCategory: '', relatedCity: null }, taxonomy) === null,
  );
  check(
    'renaming a post that was ever published mints a 301 (even while unpublished)',
    shouldMintRedirect({ slug: 'viejo', publishedAt: '2026-01-10' }, 'nuevo'),
  );
  check(
    'renaming a never-published draft does not',
    !shouldMintRedirect({ slug: 'viejo', publishedAt: null }, 'nuevo'),
  );
  check('keeping the slug never mints one', !shouldMintRedirect({ slug: 'igual', publishedAt: '2026-01-10' }, 'igual'));
  check(
    'updateBlogPost() decides through shouldMintRedirect()',
    /if \(shouldMintRedirect\(previous, input\.slug\)\)/.test(dbBlogSource),
  );

  // The editor's live counters and checklist.
  check('word count ignores link targets and syntax', wordCount('## Hola\n\nUn [enlace](/empleos/abc-def) y **dos**.') === 5, String(wordCount('## Hola\n\nUn [enlace](/empleos/abc-def) y **dos**.')));
  check('reading time is at least a minute', readingMinutes(0) === 1 && readingMinutes(1000) === 5);
  {
    const good = seoChecklist({
      title: 'Cómo conseguir trabajo en ventas en Paraguay',
      description: 'Qué buscan los empleadores de ventas en Paraguay y cómo preparar tu postulación para destacar.',
      body: `Mirá los [empleos de ventas](/trabajo/ventas) publicados.\n\n## Qué buscan\n\n${'palabra '.repeat(720)}`,
      category: 'guias-por-sector',
      relatedCategory: 'ventas',
    });
    check('a brief-compliant article passes every check', good.every((c) => c.ok), JSON.stringify(good.filter((c) => !c.ok)));
    const bad = seoChecklist({
      title: 'Corto',
      description: 'Muy corta.',
      body: `${'palabra '.repeat(250)} [link](https://example.com) [empleos](/empleosx)`,
      category: 'guias-por-sector',
      relatedCategory: '',
    });
    const failed = new Set(bad.filter((c) => !c.ok).map((c) => c.id));
    check(
      'the checklist flags title, description, missing h2, missing landing link and missing guide category',
      ['title-length', 'description-length', 'has-h2', 'landing-link', 'landing-link-early', 'length', 'guide-related-category'].every((id) =>
        failed.has(id),
      ),
      [...failed].join(', '),
    );
    const late = seoChecklist({
      title: 'x',
      description: 'y',
      body: `${'palabra '.repeat(250)} [empleos](/empleos)`,
      category: 'consejos-cv',
      relatedCategory: '',
    });
    check(
      'a landing link after the first 200 words passes "has a link" but not "early"',
      late.find((c) => c.id === 'landing-link')?.ok === true && late.find((c) => c.id === 'landing-link-early')?.ok === false,
    );
    const hasH2 = (body: string) =>
      seoChecklist({ title: '', description: '', body, category: 'noticias', relatedCategory: '' }).find(
        (c) => c.id === 'has-h2',
      )?.ok;
    check(
      'only a real ## counts as a subtitle (not ###, # or a #hashtag)',
      hasH2('texto\n\n## Subtítulo') === true &&
        hasH2('### Solo h3') === false &&
        hasH2('# Título') === false &&
        hasH2('texto con #hashtag') === false,
    );
    check(
      'a city landing and an absolute production URL count as landing links',
      seoChecklist({ title: '', description: '', body: '[a](/trabajo-en/luque)', category: 'noticias', relatedCategory: '' }).find((c) => c.id === 'landing-link')?.ok === true &&
        seoChecklist({ title: '', description: '', body: '[a](https://trabajo.com.py/empleos?q=x)', category: 'noticias', relatedCategory: '' }).find((c) => c.id === 'landing-link')?.ok === true,
    );
  }

  // -------------------------------------------------------------------------
  // 3h. The C0 drafts are importable (PLAN-GROWTH.md §4 C0).
  // -------------------------------------------------------------------------
  // content/blog/drafts/ is what `blog:import -- --drafts` inserts, and that
  // import refuses the whole batch if one file fails scripts/blog-drafts.ts.
  // Checking it here means a draft that could not be imported never merges.
  {
    const reports = await checkDrafts();
    for (const r of reports) {
      check(`draft ${r.file.replace(process.cwd() + '/', '')} is importable`, r.errors.length === 0, r.errors.join('; '));
    }
    const legalFixture = checkDraftBodyRules('derechos-laborales', 'Sin marca de revisión.\n\nTexto.');
    check(
      'a derechos-laborales draft without the review marker and disclaimer is refused',
      legalFixture.length === 2,
      legalFixture.join('; '),
    );
  }

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
