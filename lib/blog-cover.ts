// Upload mechanics for a blog post's cover image (PLAN-IMAGES.md §5,
// PLAN-PHASE3-DRAFT.md §11). Deliberately a copy of lib/company-logo.ts's
// shape rather than a shared abstraction: the two differ in namespace and in
// nothing else today, and a premature "uploadImageFor(entity)" helper would put
// the namespace — the one argument that must always be a literal, never derived
// from a request (lib/image-storage.ts) — behind a parameter.
//
// This is the caller PLAN-IMAGES.md §9.3 said the reserved `blog` namespace
// would only get if Väg B were ever decided. It was, on 2026-08-12.
import 'server-only';

import {
  deleteImage,
  imagePublicUrl,
  IMAGE_REJECTION_MESSAGES,
  MAX_IMAGE_UPLOAD_BYTES,
  readLimitedImageBody,
  storeImage,
} from './image-storage';

export type BlogCoverUploadResult =
  | { ok: true; key: string; url: string }
  | { ok: false; status: 400 | 413; error: string };

/**
 * Read the raw body, store the new object, then delete the old one (if any).
 * Store first, delete second: a rejected upload must never take down the cover
 * that is currently live. A failed delete of the old object does not fail the
 * request — the new key is already stored and about to be written to the row,
 * so it is swallowed and logged: one orphan beats a broken row.
 */
export async function uploadBlogCover(
  request: Request,
  existingKey: string | null,
): Promise<BlogCoverUploadResult> {
  const body = await readLimitedImageBody(request);
  if (!body.ok) {
    return body.reason === 'too_large'
      ? {
          ok: false,
          status: 413,
          error: `La imagen supera los ${MAX_IMAGE_UPLOAD_BYTES / (1024 * 1024)} MB.`,
        }
      : { ok: false, status: 400, error: IMAGE_REJECTION_MESSAGES.empty };
  }

  const stored = await storeImage('blog', body.bytes);
  if (!stored.ok) {
    return { ok: false, status: 400, error: IMAGE_REJECTION_MESSAGES[stored.reason] };
  }

  if (existingKey) {
    try {
      await deleteImage(existingKey);
    } catch (err) {
      console.error('[blog-cover] failed to delete old cover object', existingKey, err);
    }
  }

  return { ok: true, key: stored.key, url: imagePublicUrl(stored.key) };
}

/** Delete the object backing a cover. Callers clear `coverImageKey` afterward. */
export async function removeBlogCoverObject(key: string): Promise<void> {
  await deleteImage(key);
}
