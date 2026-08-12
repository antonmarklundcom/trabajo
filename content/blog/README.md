# content/blog/

Each article is a `.md` file in this directory. The filename (without `.md`)
is the slug, so it's also the live URL (`/blog/<slug>`) — renaming a
published file is a URL change and needs a 301, not just a rename
(AGENTS.md: slugs are live SEO URLs).

## Frontmatter

A flat `key: value` block at the top of the file, delimited by `---`. No
lists, no nesting — every value is a single line of text.

```
---
title: Cómo escribir un CV en Paraguay
description: Guía práctica de una página, con lo que los empleadores paraguayos realmente miran.
category: consejos-cv
publishedAt: 2026-08-14
updatedAt: 2026-08-14
published: true
relatedCategory: administracion
relatedCity: asuncion
---
```

| Field | Required | Format | Notes |
|---|---|---|---|
| `title` | yes | text | Article title and page `<title>` |
| `description` | yes | text, max 160 chars | Meta description, OG description, and listing summary |
| `category` | yes | `noticias` \| `analisis-laboral` \| `consejos-cv` | Closed list — any other value fails the build |
| `publishedAt` | yes | `YYYY-MM-DD` | Sets the listing order and `datePublished` |
| `updatedAt` | yes | `YYYY-MM-DD` | Sitemap `lastModified` and `dateModified` |
| `published` | yes | `true` \| `false` | `false` means the article does not exist: no listing entry, no route, no sitemap entry |
| `relatedCategory` | no | an existing job category slug | With `relatedCity`, drives the "Empleos relacionados" block via `lib/data.ts` |
| `relatedCity` | no | an existing job city slug | See above |
| `coverImage` | no | a bare `.webp` filename | The article's cover image. See **Cover images** below |
| `coverAlt` | **yes, if `coverImage` is set** | text, max 160 chars | Spanish (PY), like all UI copy. A cover without alt text fails the build |

Invalid frontmatter (missing field, bad category, bad date format) throws at
build time — an article never silently gets skipped.

## Body

Standard Markdown (GFM) via `marked`. See the comment in `lib/blog.ts` for
why raw HTML passthrough is off and no sanitizer is used.

## Content rules

Articles here are AI-drafted and edited/approved by the site owner — not
reviewed by an editorial desk. Two rules follow from that:

- **No figure without a source.** Salary stats, unemployment rates, "X% of
  Paraguayan employers…" — either link the source (DGEEC/INE, MTESS, IPS) in
  the text, or cut the claim.
- **No legal advice in the first person.** "According to Código del Trabajo
  art. X, Y applies" with a citation — never "you are entitled to claim Z".
  The portal is not a law firm and should not read like one.

## Cover images

Optional. An article without one is a normal case and renders exactly as it
does today — no placeholder, no empty box.

Cover images are **committed files**, not uploads. They live in
`public/blog-covers/` and are served statically at `/blog-covers/<filename>`.
They deliberately do not go through `lib/image-storage.ts`: that pipeline
defends against a stranger putting bytes on our origin at runtime, and a cover
image arrives in a pull request from someone who can already deploy arbitrary
code (`PLAN-PHASE3.md` §9.2).

The rules that pipeline would have enforced are enforced by
`npm run blog:verify` in CI instead:

| Rule | Value |
|---|---|
| Format | WebP, not animated |
| Dimensions | **exactly 1600x900** — the page writes these as constants, so any other size renders stretched |
| Size | under 200 KB |
| Alt text | required whenever `coverImage` is set |
| Orphans | every file in `public/blog-covers/` must be referenced by some article, including unpublished ones |

`coverImage` is a bare filename — no folders, no uppercase, no other
extension. It does **not** have to match the article's slug, so two articles
may share one generic cover.

### Producing a cover

From any source image, using the repo's own `sharp` (do not pull in
`sharp-cli` with `npx` for this):

```
node -e "require('sharp')('foto.jpg').resize(1600,900,{fit:'cover'}).webp({quality:82}).toFile('public/blog-covers/<name>.webp')"
```

Quality 82 is the same number the upload pipeline uses (`PLAN-IMAGES.md` §3),
so a committed cover and an uploaded job image look alike. Then add both
fields to the frontmatter and run `npm run blog:verify` before opening the PR.

**Deleting an article also means deleting its cover** — CI fails on a file no
article references, because git has no delete hook to do it for us.

## Publishing an article

1. Add the `.md` file here with `published: true`.
2. Open a PR. There is no database or admin panel — content ships via Git.
