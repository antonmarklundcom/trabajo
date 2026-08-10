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

## Publishing an article

1. Add the `.md` file here with `published: true`.
2. Open a PR. There is no database or admin panel — content ships via Git.
