# content/blog-drafts/ — C0 pilot, not yet imported

These are drafts for the C0 content sprint (`PLAN-GROWTH.md` §4). They are
**not** read by the site.

`npm run blog:drafts` checks every file here against the rules the admin form
enforces (description length, the guías-por-sector category, taxonomy slugs),
the `Revisión pendiente` + disclaimer lines on `derechos-laborales`, and that
every internal link resolves to a real route; `blog:verify` runs the same check
in CI. Unresolved `[VERIFICAR: …]` markers are listed as warnings.

Instead of pasting one by one (steps below), all of them can be inserted as
**Borrador** at once: `npm run blog:import -- --drafts` (dry run), then
`npm run blog:import -- --drafts --write`. Needs `DATABASE_URL` and migration
`0015` applied first. Drafts get no date — it becomes the day you publish.
Slugs already in the table are skipped, never overwritten. Resolve the
VERIFICAR markers in `/admin/blog` before switching any of them to Publicado.

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

## Markers in the second batch (2026-09-27)

The 23 drafts added on 2026-09-27 use two markers the owner must clear before
pasting anything into `/admin/blog`:

- **`[VERIFICAR: …]`** wraps every legal claim, article number, rate, amount or
  period that could not be read in a primary source during the writing
  session. Outbound access to bacn.gov.py, mtess.gov.py, ips.gov.py and ilo.org
  was blocked again; where a web search returned a consistent figure, the
  marker carries it plus the source to check (e.g. "art. 87 según búsqueda
  web"), but **none of them has been read in the official text**. Resolve each
  one against the source and delete the marker, or cut the sentence.
- **`> **Revisión pendiente:** …`** opens every `derechos-laborales` draft
  (PLAN-GROWTH.md §7 D14). Those drafts stay unpublished until a lawyer has
  read them; delete the line only then. They also carry the standing line
  `Esta nota es informativa y no reemplaza el asesoramiento de un profesional.`

All 23 have `published: false`; the admin form's **Estado** is what actually
decides, so set it to `Borrador` when pasting unless the draft is fully
reviewed.

## Sector guides added 2026-09-27 (second session)

`como-conseguir-trabajo-en-{contabilidad,salud,construccion,marketing}.md` fill
the four job categories the first batch had no guide for, so all ten
`/trabajo/{cat}` landings now have one. No legal claims or figures; no
VERIFICAR markers.
