// Render precedence + upload mechanics shared by the employer and admin logo
// routes (PLAN-IMAGES.md §5, PR 19). One place for the "which column wins"
// decision so it is not re-derived at every CompanyAvatar call site, and one
// place for the delete-then-store replacement order so both auth paths (
// employer, admin) can't drift apart on it.
import 'server-only';

import {
  deleteImage,
  imagePublicUrl,
  IMAGE_REJECTION_MESSAGES,
  MAX_IMAGE_UPLOAD_BYTES,
  readLimitedImageBody,
  storeImage,
} from './image-storage';

/**
 * `logoKey` wins whenever present; `logoUrl` is legacy data that only
 * renders when there is no key. Nothing ever writes both — see the schema
 * comment on `companies.logoKey`.
 */
export function companyLogoSrc(logoKey: string | null, logoUrl: string | null): string | null {
  if (logoKey) return imagePublicUrl(logoKey);
  return logoUrl || null;
}

export type LogoUploadResult =
  | { ok: true; key: string; url: string }
  | { ok: false; status: 400 | 413; error: string };

/**
 * Read the raw body, delete the old object (if any), store the new one.
 * Object first, row second: the caller writes `logoKey` only after this
 * resolves, so a failed delete never leaves a new key unrecorded and a
 * failed store never clears the old key.
 */
export async function uploadCompanyLogo(
  request: Request,
  existingLogoKey: string | null,
): Promise<LogoUploadResult> {
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

  // Delete before store, and let a failed delete propagate — the caller's
  // route handler turns that into a 500 without ever calling storeImage(),
  // so the row keeps pointing at the (still live) old object.
  if (existingLogoKey) {
    await deleteImage(existingLogoKey);
  }

  const stored = await storeImage('logos', body.bytes);
  if (!stored.ok) {
    return { ok: false, status: 400, error: IMAGE_REJECTION_MESSAGES[stored.reason] };
  }

  return { ok: true, key: stored.key, url: imagePublicUrl(stored.key) };
}

/** Delete the object backing a logo. Callers clear `logoKey` afterward. */
export async function removeCompanyLogoObject(logoKey: string): Promise<void> {
  await deleteImage(logoKey);
}
