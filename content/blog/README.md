# content/blog/

**Superseded.** The blog moved from Markdown files (Väg A) to the `blog_posts`
table (Väg B) on 2026-08-12 — the owner wants to publish from `/admin/blog`
directly, without going through Git. See PLAN-PHASE3-DRAFT.md §5.1 for the
original decision and the note recording the reversal.

`lib/blog.ts` no longer reads this directory at all. The three articles that
existed here were carried into the database by
`scripts/migrate-blog-content-to-db.ts` (`npm run blog:migrate`) — see that
script for the one-time migration. These `.md` files are kept only as the
historical record of what was migrated; editing one does nothing to the live
site.

## Publishing an article now

1. Log in at `/admin/login` with an `admin` or `editor` account.
2. Go to `/admin/blog` → **Nuevo artículo**.
3. Write the body as Markdown in the textarea — the "Ver vista previa" toggle
   renders it live through the same function the public page uses
   (`lib/blog.ts`'s `renderMarkdown`, re-exported from `lib/markdown.ts`).
4. Set status to **Publicado** to make it live immediately, or leave it as
   **Borrador** — a draft is visible only to an authenticated admin/editor at
   its real URL, and 404s for everyone else.
5. Add a cover afterward from the edit screen if you want one. It is cropped
   to 16:9 automatically; the alt text is required and describes the image
   in Spanish.

Content rules are unchanged from Väg A:

- **No figure without a source.** Salary stats, unemployment rates, "X% of
  Paraguayan employers…" — either link the source (DGEEC/INE, MTESS, IPS) in
  the text, or cut the claim.
- **No legal advice in the first person.** "According to Código del Trabajo
  art. X, Y applies" with a citation — never "you are entitled to claim Z".
  The portal is not a law firm and should not read like one.
- **The slug is a live SEO URL.** It is editable up until the first time an
  article is published; after that it is locked in the admin form and
  rejected server-side if you try to change it anyway (AGENTS.md).
