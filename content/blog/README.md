# content/blog/ — historical

**These files are no longer read by the site.** As of 2026-08-12 articles live
in the `blog_posts` table and are written from `/admin/blog`
(`PLAN-PHASE3-DRAFT.md` §11). The `.md` files here are kept as the record of
what `scripts/blog-import.ts` imported, under the same slugs; nothing renders
from them and editing one changes nothing.

Deleting them is safe once the import has run against production. They are kept
for now because a one-time import is easier to re-run — or to check — while its
input still exists.

## Writing an article now

`/admin/blog` → **+ Nuevo artículo**. Fields, and what each one is for:

| Field | Notes |
|---|---|
| Título | The `<h1>` and the SERP title. |
| Slug | Optional; generated from the title. Editing it on a **published** article creates a 301 from the old URL automatically — no manual redirect step. |
| Descripción | The `<meta name="description">` and the share text. 50–160 characters, enforced. The form shows a Google preview as you type. |
| Categoría | `noticias`, `analisis-laboral` or `consejos-cv`. Closed list. |
| Estado | `Borrador` is invisible everywhere — no route, not in the list, not in the sitemap. `Publicado` is live immediately. |
| Fecha de publicación | The editorial date. Left empty, it is today. |
| Empleos relacionados | A category and/or city; up to five published jobs are shown at the foot of the article. This is internal linking — it is most of the SEO value the blog has. |
| Contenido | Markdown. `##` heading, `**bold**`, `[text](/empleos)`, `-` lists, tables. Pasted HTML renders as visible text; it is never executed. |
| Portada | Optional. JPG/PNG/WebP up to 4 MB, converted to WebP for you. Alt text is required before the file picker opens. |

**Vista previa** renders the body through the same function the public page
uses, so what you see is what ships.

## Content rules (unchanged from Väg A — `PLAN-PHASE3-DRAFT.md` §5.2)

These predate the admin panel and survive it, because they are about what the
site can be trusted on, not about how the text gets saved:

- **No number without a source.** Salary statistics, unemployment figures,
  "X % of Paraguayan employers…" — either with a link to the source (DGEEC/INE,
  MTESS, IPS) in the text, or the claim is cut. An unsourced salary figure is
  what makes this kind of site lose credibility, and it is also the thing people
  forward.
- **No legal advice in the first person.** "Según el Código del Trabajo art. X
  corresponde Y", with the reference — never "tenés derecho a exigir Z". The
  portal is not a law firm and must not read like one.
- **No candidate data, ever.** No "popular among applicants" widget, no "X
  people applied to this job", no application statistics. The blog reads the
  public job catalog through `lib/data.ts` and nothing else.

## Deleting an article

Deleting removes the row, its cover image and its redirects. If the URL was
indexed, that turns a live page into a 404 — usually you want `Borrador`
instead, which unpublishes without destroying the text.
