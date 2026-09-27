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
 * Read the raw body, store the new object, point the row at it, then delete
 * the old one (if any).
 * Store first, delete last: a rejected upload must never take down the cover
 * that is currently live, and the old object is only deleted once the row
 * already points at the new one. A failed delete of the old object does not
 * fail the request — it is logged: one orphan beats a broken row.
 */
export async function uploadBlogCover(
  request: Request,
  existingKey: string | null,
  /** Writes the new key to the row. Runs after the store, before the old object is deleted. */
  savePointer: (key: string) => Promise<void>,
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

  // The row moves to the new key BEFORE the old object goes. The other order
  // deleted the live cover first, so a failed row write left the row pointing
  // at an object that no longer existed — a broken image on a public page.
  // If the row write fails now, the NEW object is the one cleaned up and the
  // old cover stays exactly as it was; the error still fails the request.
  try {
    await savePointer(stored.key);
  } catch (err) {
    await deleteImage(stored.key).catch((cleanupErr) =>
      console.error('[blog-cover] failed to clean up unsaved cover object', stored.key, cleanupErr),
    );
    throw err;
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

/**
 * Clears the row first, then deletes the object — same rule as the upload
 * path: one orphaned object (invisible, costs a few KB) beats a row pointing
 * at a deleted image (a broken image on a public page). A failed delete is
 * logged, not thrown: the cover is already gone from every page.
 */
export async function removeBlogCover(key: string, clearPointer: () => Promise<void>): Promise<void> {
  await clearPointer();
  try {
    await deleteImage(key);
  } catch (err) {
    console.error('[blog-cover] failed to delete removed cover object', key, err);
  }
}
