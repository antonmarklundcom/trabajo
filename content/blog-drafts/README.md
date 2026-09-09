# content/blog-drafts/ — C0 pilot, not yet imported

These are drafts for the C0 content sprint (`PLAN-GROWTH.md` §4). They are
**not** read by the site and are **not** picked up by `scripts/blog-import.ts`
(that script is a one-time historical importer scoped to the original three
categories — see `content/blog/README.md`).

Publishing path for each file here:

1. Review and edit the draft.
2. Apply the C1 migration in production first (`npm run db:migrate`) if the
   file's `category` isn't one of `noticias | analisis-laboral | consejos-cv`
   yet — the four new categories don't exist as valid enum values until then.
3. Copy the frontmatter fields into `/admin/blog` → **+ Nuevo artículo**
   (título, descripción, categoría, empleos relacionados) and paste the body
   into **Contenido**.
4. Once published, the file here can be deleted — same convention as
   `content/blog/`.

## Fact-checking note

Legal/labour drafts (`derechos-laborales`) cite the law (Ley N.º 213/93,
Código del Trabajo) and institutions (IPS, MTESS) by name, but this session's
outbound web access was blocked for every source site it tried, so **no
specific article number is asserted** in these drafts — only what could be
corroborated from general knowledge plus unreachable-but-consistent search
snippets. Verify article numbers and current figures (period lengths,
contribution percentages) against the official Código del Trabajo or MTESS
before publishing anything in this category.
