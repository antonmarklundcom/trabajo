// Sanitization for admin-authored blog HTML (PR 20, Väg B).
//
// PLAN-PHASE3-DRAFT.md §8.1 judged a sanitizer unnecessary for Väg A: article
// bodies were Markdown committed to this repo, so whoever could publish one
// could already publish arbitrary React, and a sanitizer would defend against
// an attacker who had, by definition, already won. That review explicitly
// flagged that the argument does NOT carry to Väg B: "artikeltexten ligger i
// databasen" — the body is no longer git-reviewed content, it is a value a
// POST request writes to a column, submitted by a rich-text editor (Tiptap)
// whose UI constrains what a human clicking around can produce, but which
// says nothing about what the HTTP request that saves it actually contains.
// The trust boundary moved from "git diff" to "authenticated admin session",
// and this module is what makes that boundary real rather than assumed — the
// same reasoning PLAN-IMAGES.md applies to uploaded bytes applies here to
// uploaded markup: never store what was received, store what was verified.
//
// Sanitized ONCE, at write time (createBlogPost/updateBlogPost in
// lib/db/blog-admin.ts), not at render time. The stored value is the trusted
// value — app/blog/[slug]/page.tsx renders it directly. This keeps there
// being exactly one place "safe HTML" is decided, instead of a write-time
// pass and a read-time pass that can silently drift apart.
import DOMPurify from 'isomorphic-dompurify';
import { IMAGE_STORAGE_KEY_PATTERN } from './image-storage';

/**
 * What the Tiptap StarterKit + Image + Link extensions can actually produce,
 * plus nothing else. Deliberately closed rather than "block the obviously bad
 * stuff" — script/style/iframe/on* are refused by omission, not by a denylist
 * that has to anticipate every future trick.
 */
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 's', 'code', 'pre',
  'h2', 'h3', 'h4',
  'ul', 'ol', 'li',
  'blockquote',
  'a', 'img',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'src', 'alt', 'width', 'height'];

export function sanitizeBlogHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Belt for ALLOWED_ATTR already omitting them: DOMPurify treats these as
    // attack surface regardless of tag/attr allowlists (event handlers,
    // javascript: URIs) and this makes the refusal explicit rather than
    // incidental to what ALLOWED_ATTR happens to list.
    ALLOW_DATA_ATTR: false,
    FORBID_ATTR: ['style', 'srcset'],
  });
}

/**
 * Every image-storage key referenced by a sanitized blog body, so
 * lib/db/blog-admin.ts can record ownership (blogPosts.imageKeys) without
 * trusting a client-supplied list. Deliberately re-derived from the HTML
 * DOMPurify already approved, and restricted to the `blog` namespace only —
 * the upload endpoint this editor calls (/api/admin/blog/images) never mints
 * a `logos` or `jobs` key, so a src in either namespace is not a key this
 * post owns and must not be recorded as one (it would make deleteBlogPost()
 * call deleteImage() on an object a *different* row is responsible for).
 * Every extracted key is also checked against IMAGE_STORAGE_KEY_PATTERN, the
 * same pattern lib/image-storage.ts asserts on every driver call — an src
 * that doesn't match was never going to resolve to a real object anyway.
 */
// Matches the key wherever it sits in the src — relative under the disk
// driver ("/img/blog/{uuid}.webp"), absolute under a future R2 driver
// ("https://images.example.com/img/blog/{uuid}.webp"). PLAN-IMAGES.md §2.1
// guarantees switching drivers costs an env var, not a rewrite of stored
// rows — this must not be the one place that promise breaks quietly.
const IMG_SRC_PATTERN = /<img[^>]+src="([^"]*)"/g;

export function extractInlineImageKeys(sanitizedHtml: string): string[] {
  const keys = new Set<string>();
  for (const match of sanitizedHtml.matchAll(IMG_SRC_PATTERN)) {
    const src = match[1];
    const key = src.match(/img\/blog\/[0-9a-f-]+\.webp$/)?.[0];
    if (key && IMAGE_STORAGE_KEY_PATTERN.test(key)) keys.add(key);
  }
  return [...keys];
}
