# content/blog-drafts/ — C0 pilot, not yet imported

> **Folded into site guides (PLAN-SEO.md §2 item 3) — do not publish as blog posts:**
> `cv-sin-experiencia-paraguay`, `carta-de-presentacion-con-ejemplo`,
> `preguntas-frecuentes-en-una-entrevista-de-trabajo`, `aguinaldo-en-paraguay`,
> `salario-minimo-en-paraguay`, `despido-preaviso-e-indemnizacion-en-paraguay`,
> `trabajo-de-medio-tiempo-para-estudiantes`,
> `como-buscar-trabajo-sin-experiencia-en-asuncion`. Their content now lives on
> fixed pages (`/curriculum-vitae/sin-experiencia`, `/carta-de-presentacion`,
> `/entrevista-de-trabajo`, `/calculadora-de-aguinaldo`, `/salario-minimo`,
> `/preaviso-e-indemnizacion`, `/trabajo-medio-tiempo`,
> `/trabajo-sin-experiencia`); a blog copy would compete with them in search.

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
