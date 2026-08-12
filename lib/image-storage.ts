// Public image storage — the shared pipeline behind company logos, blog
// images and job-posting images (PLAN-IMAGES.md).
//
// This is lib/storage.ts's mirror image, in both senses. Same shape: two
// drivers behind one interface, selected by IMAGE_STORAGE_DRIVER=disk|r2, with
// no default so a half-configured deploy fails loudly. Opposite threat model:
// lib/storage.ts protects private bytes from being read, this file protects the
// public from the bytes. A CV mistake leaks one person's file; a mistake here
// hosts an attacker's file under our own domain, which is stored XSS with our
// origin's cookies in reach.
//
// Three properties carry that weight, and none of them are the caller's job:
//
//   1. WHAT WE ACCEPT is decided by magic bytes (JPEG, PNG, WebP — see
//      detectImageFileType), never by the client's Content-Type and never by a
//      filename. SVG is XML with <script> in it and is rejected by not being on
//      the list; GIF is rejected deliberately (see the note there).
//   2. WHAT WE STORE is never what was uploaded. Every accepted image is
//      re-encoded to WebP by sharp and the original bytes are dropped, so a
//      polyglot file that is a valid PNG *and* a valid HTML page cannot survive
//      the round trip — the re-encoder reads pixels and writes a new container.
//      Re-encoding also strips EXIF, which is where a phone puts GPS.
//   3. WHAT WE ADDRESS is a minted key: img/{namespace}/{uuid}.webp, asserted
//      against IMAGE_STORAGE_KEY_PATTERN on every driver method. The uploader's
//      filename never reaches a key, a path or a header.
//
// The public URL is the one place the drivers differ above this file, so
// callers store the KEY in the database and call imagePublicUrl() at render
// time. Storing the URL instead would make IMAGE_STORAGE_DRIVER a one-way door
// (every existing row would point at the old backend); storing the key keeps it
// an env var, which is the same seam trick as DATA_SOURCE and CV_STORAGE_DRIVER.
import 'server-only';

import { randomUUID } from 'node:crypto';

import { readLimitedBody, type BodyReadResult } from './cv';
import { signedS3Fetch, type S3Config } from './storage';

// ---------------------------------------------------------------------------
// Namespaces, keys, limits
// ---------------------------------------------------------------------------

/**
 * The only prefixes that exist, fixed at the type level: `logos` (PR 19,
 * company logos) and `jobs` (PR 21, job-posting images). A namespace is not
 * user input — a caller names the one it owns as a literal, which is what keeps
 * the key un-derivable from a request.
 *
 * `blog` was reserved with no caller from 2026-08-10 to 2026-08-12, against the
 * possibility of a Väg B blog. That is now what the blog is: article bodies
 * live in blog_posts and the cover image is uploaded from /admin/blog through
 * lib/blog-cover.ts (PLAN-PHASE3-DRAFT.md §11). The reservation was kept
 * precisely so this could happen without re-opening the union, its key pattern
 * and verify-image-storage.ts — which is what it cost, and it cost nothing.
 */
export const IMAGE_NAMESPACES = ['logos', 'blog', 'jobs'] as const;
export type ImageNamespace = (typeof IMAGE_NAMESPACES)[number];

/** The only shape an image key may have: img/{namespace}/{uuid}.webp. */
export const IMAGE_STORAGE_KEY_PATTERN =
  /^img\/(?:logos|blog|jobs)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

/**
 * 4 MB on the uploaded body — under the CV limit, and chosen against what a
 * phone actually produces: a 12 MP JPEG straight off an Android camera is
 * 2–4 MB, and rejecting the owner's own photo of their storefront is a support
 * ticket, not a security win. The byte cap is not the DoS defence anyway —
 * MAX_IMAGE_INPUT_PIXELS is, because compression ratio is the attacker's free
 * variable and 4 MB of PNG can declare far more pixels than 4 MB of anything
 * else.
 */
export const MAX_IMAGE_UPLOAD_BYTES = 4 * 1024 * 1024;

/**
 * 40 megapixels of *input*, checked from the header before a pixel is decoded
 * and enforced again inside the decoder via sharp's limitInputPixels. This is
 * the decompression-bomb gate: a 43000×43000 PNG is a few hundred KB on the
 * wire and ~7 GB of RGBA in memory. 40 MP is comfortably above any real camera
 * (a 100 MP phone sensor bins to well under it) and far below the point where
 * decoding costs the process anything it cannot spare.
 */
export const MAX_IMAGE_INPUT_PIXELS = 40_000_000;

/**
 * Output cap per namespace, applied with fit "inside" and no enlargement — an
 * image smaller than the cap is re-encoded, not upscaled.
 *
 * Logos are rendered at a few hundred CSS pixels at most, so 512 is already 2×
 * for retina; blog and job images are content-width photographs, so 1600 covers
 * a full-bleed retina column without paying for pixels nobody sees.
 */
export const IMAGE_NAMESPACE_MAX_DIMENSION: Record<ImageNamespace, number> = {
  logos: 512,
  blog: 1600,
  jobs: 1600,
};

/** Everything we store and serve is this. There is no second output format. */
export const IMAGE_OUTPUT_MIME_TYPE = 'image/webp';

/** Quality 82 is where WebP stops being visibly lossy on photographs. */
const WEBP_QUALITY = 82;

export class ImageStorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ImageStorageError';
  }
}

export function assertImageKey(key: string): void {
  if (!IMAGE_STORAGE_KEY_PATTERN.test(key)) {
    // Deliberately does not echo the key: this only fires on a bug or an
    // attack, and in the second case the log line is attacker-controlled.
    throw new ImageStorageError('Refusing to address image storage with a malformed key.');
  }
}

/**
 * img/{namespace}/{uuid}.webp. Takes no filename, no id and no caller-supplied
 * string of any kind — the namespace is a literal from the union above and the
 * rest is a v4 UUID. There is deliberately no way to influence a key from a
 * request, which is what makes the pattern assertion a tautology rather than a
 * check that could one day fail open.
 */
export function buildImageKey(namespace: ImageNamespace): string {
  if (!IMAGE_NAMESPACES.includes(namespace)) {
    throw new ImageStorageError('Unknown image namespace.');
  }
  return `img/${namespace}/${randomUUID()}.webp`;
}

/**
 * The key behind a request to `/img/...`, or null.
 *
 * `segments` is what the catch-all in `app/img/[...key]/route.ts` yields, so it
 * is the key **without** its `img/` prefix — the prefix is the mount point and
 * was consumed by the route path. Re-adding it here rather than in the route is
 * the point: the prefix is then not something a caller can forget, and the
 * whole reconstruction lives in the module the verify script exercises.
 *
 * Note what is NOT done: no decoding, no normalisation, no `..` stripping.
 * A segment that needed cleaning up is not a key we minted, so it is not a key,
 * and the route answers 404.
 */
export function imageKeyFromSegments(segments: readonly string[]): string | null {
  const key = ['img', ...segments].join('/');
  return IMAGE_STORAGE_KEY_PATTERN.test(key) ? key : null;
}

// ---------------------------------------------------------------------------
// Magic-byte detection
//
// Same discipline as detectCvFileType() in lib/cv.ts: signatures only, no
// parsing. The declared Content-Type and the filename are both chosen by the
// uploader and are not consulted anywhere in this file.
// ---------------------------------------------------------------------------

export type ImageFileType = {
  format: 'jpeg' | 'png' | 'webp';
  /** The MIME type the bytes actually are — never the one that was declared. */
  mimeType: string;
};

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WEBP_TAG = [0x57, 0x45, 0x42, 0x50]; // "WEBP", at offset 8

function matchesAt(bytes: Uint8Array, offset: number, signature: readonly number[]): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

/**
 * What these bytes actually are, or null if it is not an image we accept.
 *
 * The accepted list is deliberately short:
 *
 *   - **SVG is not on it and never will be.** An SVG is an XML document that
 *     can carry <script>, and serving one from our own origin is stored XSS by
 *     construction. It fails here by not matching any signature, but it is
 *     worth saying out loud because "images" is the category a reviewer will
 *     assume includes it.
 *   - **GIF is not on it either**, and that is a judgement rather than a
 *     necessity. Accepting it means either flattening animations (surprising:
 *     the user uploads a moving image and gets a still one) or converting them
 *     frame by frame, which turns frame *count* into a second decompression-bomb
 *     dimension that MAX_IMAGE_INPUT_PIXELS does not bound. Nothing in PR 19–21
 *     needs animation; a static GIF is a worse JPEG. If a future feature wants
 *     it, the cost is bounding pages × width × height, not adding four bytes to
 *     this function.
 *   - Nothing else here decodes or parses. A signature match is a claim, not a
 *     verdict — the verdict is whether sharp can read it in processImage().
 */
export function detectImageFileType(bytes: Uint8Array): ImageFileType | null {
  if (matchesAt(bytes, 0, JPEG_SIGNATURE)) {
    return { format: 'jpeg', mimeType: 'image/jpeg' };
  }
  if (matchesAt(bytes, 0, PNG_SIGNATURE)) {
    return { format: 'png', mimeType: 'image/png' };
  }
  // RIFF is a container shared with WAV and AVI, so the WEBP tag at offset 8 is
  // what actually decides — the same "container plus payload marker" pair as
  // the ZIP/docx check in lib/cv.ts.
  if (matchesAt(bytes, 0, RIFF_SIGNATURE) && matchesAt(bytes, 8, WEBP_TAG)) {
    return { format: 'webp', mimeType: 'image/webp' };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Reading the upload
// ---------------------------------------------------------------------------

/**
 * MAX_IMAGE_UPLOAD_BYTES enforced on the streaming body.
 *
 * The reader is lib/cv.ts's, on purpose. It is the piece that makes the limit
 * real rather than decorative — Content-Length rejected up front when it is
 * present and oversized, then a running total per chunk that cancels the stream
 * one byte over, so a lying or absent header changes nothing. That logic should
 * exist once in this repo, and it already existed there first.
 */
export function readLimitedImageBody(request: Request): Promise<BodyReadResult> {
  return readLimitedBody(request, MAX_IMAGE_UPLOAD_BYTES);
}

// ---------------------------------------------------------------------------
// Validation + WebP conversion
// ---------------------------------------------------------------------------

export type ImageRejection =
  | 'empty'
  | 'too_large'
  | 'unsupported_type'
  | 'too_many_pixels'
  | 'animated'
  | 'decode_failed';

export type ProcessedImage = {
  /** WebP bytes we produced ourselves. The upload's bytes are not kept. */
  bytes: Uint8Array;
  width: number;
  height: number;
};

export type ImageProcessResult =
  | ({ ok: true } & ProcessedImage)
  | { ok: false; reason: ImageRejection };

/**
 * Spanish (Paraguay) copy for each rejection, so PR 19–21 show the same words
 * for the same failure instead of inventing three vocabularies. UI copy lives
 * here rather than in the components because the reason codes are this module's
 * and a caller cannot see which one it will get.
 */
export const IMAGE_REJECTION_MESSAGES: Record<ImageRejection, string> = {
  empty: 'No recibimos ningún archivo.',
  too_large: 'La imagen supera los 4 MB.',
  unsupported_type: 'Formato no válido. Subí una imagen JPG, PNG o WebP.',
  too_many_pixels: 'La imagen tiene demasiados píxeles. Reducí su tamaño e intentá de nuevo.',
  animated: 'No aceptamos imágenes animadas. Subí una imagen fija.',
  decode_failed: 'No pudimos procesar la imagen. Probá con otro archivo.',
};

/**
 * Uploaded bytes in, WebP bytes out — or a reason we refused.
 *
 * The order of the gates is the point. Cheap and certain first (magic bytes),
 * then the header (dimensions and frame count, which sharp reads without
 * decoding pixels), and only then the decoder. Nothing that failed an earlier
 * gate reaches a later one, so the expensive, attack-surface-rich step runs
 * exclusively on inputs that already claimed to be a bounded still image.
 *
 * The output is verified to be WebP before it is returned. That check should be
 * impossible to fail — we just asked for WebP — and it is here anyway, because
 * "the bytes we store are the bytes we produced" is the invariant everything
 * downstream leans on, and an invariant nobody asserts is a comment.
 */
export async function processImage(
  namespace: ImageNamespace,
  input: Uint8Array,
): Promise<ImageProcessResult> {
  if (input.byteLength === 0) return { ok: false, reason: 'empty' };
  if (input.byteLength > MAX_IMAGE_UPLOAD_BYTES) return { ok: false, reason: 'too_large' };
  if (detectImageFileType(input) === null) return { ok: false, reason: 'unsupported_type' };

  const maxDimension = IMAGE_NAMESPACE_MAX_DIMENSION[namespace];
  if (!maxDimension) throw new ImageStorageError('Unknown image namespace.');

  // Loaded lazily: sharp is a native module of some weight, and nothing that
  // only needs imagePublicUrl() should pay for it at import time.
  const { default: sharp } = await import('sharp');

  const pipeline = sharp(input, {
    // Belt to the metadata check below: even if a header lies or a format we
    // did not anticipate reports its size differently, libvips itself refuses
    // to allocate past this.
    limitInputPixels: MAX_IMAGE_INPUT_PIXELS,
    // Read the first frame only. Combined with the `pages` check below, an
    // animation is refused rather than silently flattened.
    animated: false,
  });

  let width: number;
  let height: number;
  try {
    const metadata = await pipeline.metadata();
    width = metadata.width ?? 0;
    height = metadata.height ?? 0;
    if (width <= 0 || height <= 0) return { ok: false, reason: 'decode_failed' };
    if (width * height > MAX_IMAGE_INPUT_PIXELS) return { ok: false, reason: 'too_many_pixels' };
    if ((metadata.pages ?? 1) > 1) return { ok: false, reason: 'animated' };
  } catch {
    // A header sharp cannot read is not an image, whatever its first bytes said.
    return { ok: false, reason: 'decode_failed' };
  }

  try {
    const { data, info } = await pipeline
      // Applies the EXIF orientation and then drops the tag, so a portrait
      // photo does not come back sideways once the metadata is gone.
      .rotate()
      .resize({ width: maxDimension, height: maxDimension, fit: 'inside', withoutEnlargement: true })
      // No withMetadata(): sharp strips EXIF, XMP and ICC unless asked to keep
      // them, and EXIF is where a phone writes GPS coordinates. Publishing a
      // logo should not publish the address it was photographed at.
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });

    const bytes = new Uint8Array(data);
    if (detectImageFileType(bytes)?.format !== 'webp') {
      throw new ImageStorageError('Encoder did not produce WebP.');
    }

    return { ok: true, bytes, width: info.width, height: info.height };
  } catch (err) {
    if (err instanceof ImageStorageError) throw err;
    return { ok: false, reason: 'decode_failed' };
  }
}

// ---------------------------------------------------------------------------
// Driver interface
// ---------------------------------------------------------------------------

export type ImageStream = {
  body: ReadableStream<Uint8Array>;
  /** Bytes, when the driver knows it up front. */
  size: number | null;
};

export interface ImageStorageDriver {
  readonly name: 'disk' | 'r2';
  /** Always WebP. The content type is not a parameter because there is one. */
  put(key: string, body: Uint8Array): Promise<void>;
  getStream(key: string): Promise<ImageStream>;
  /** Throws on failure. Callers delete the object before the row. */
  delete(key: string): Promise<void>;
  /**
   * Where a browser fetches this image. Site-relative on disk (our own route
   * handler), absolute on R2 (the bucket's public domain) — the only place a
   * caller can tell the drivers apart, and the reason keys rather than URLs are
   * what goes in the database.
   */
  publicUrl(key: string): string;
}

let cached: ImageStorageDriver | null = null;

/**
 * The configured driver, memoized per process (env cannot change under a
 * running Node process).
 *
 * No default, for the same reason CV_STORAGE_DRIVER has none: quietly falling
 * back to disk when someone typos "r2 " would write images into a directory the
 * next deploy deletes, and the first anyone would hear of it is a page full of
 * broken images after an unrelated merge.
 */
export function getImageStorage(): ImageStorageDriver {
  if (cached) return cached;

  const configured = process.env.IMAGE_STORAGE_DRIVER?.trim().toLowerCase();
  if (configured === 'disk') cached = createImageDiskDriver();
  else if (configured === 'r2') cached = createImageR2Driver();
  else {
    throw new ImageStorageError(
      `IMAGE_STORAGE_DRIVER must be "disk" or "r2" (got ${configured ? `"${configured}"` : 'nothing'}). ` +
        'See .env.example — there is no default on purpose.',
    );
  }

  return cached;
}

/** Test/script hook. Never called from the app. */
export function resetImageStorageForTesting(): void {
  cached = null;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ImageStorageError(`${name} is required by the configured IMAGE_STORAGE_DRIVER.`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Disk driver (the default choice — PLAN-IMAGES.md §2)
// ---------------------------------------------------------------------------

export function createImageDiskDriver(): ImageStorageDriver {
  const root = requireEnv('IMAGE_STORAGE_DIR');

  return {
    name: 'disk',

    async put(key, body) {
      assertImageKey(key);
      const { mkdir, writeFile } = await import('node:fs/promises');
      const { dirname } = await import('node:path');
      const path = await resolveImagePath(root, key);
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      // 0600 like the CV driver: these are served by our own process, so the
      // web server never needs to read them and no other account should.
      // `wx` because a minted UUID key that already exists is a bug worth
      // hearing about, not a file to overwrite.
      await writeFile(path, body, { mode: 0o600, flag: 'wx' });
    },

    async getStream(key) {
      assertImageKey(key);
      const { stat } = await import('node:fs/promises');
      const { createReadStream } = await import('node:fs');
      const { Readable } = await import('node:stream');
      const path = await resolveImagePath(root, key);

      const info = await stat(path).catch(() => null);
      if (!info?.isFile()) throw new ImageStorageError('Image object not found on disk.');

      return {
        body: Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>,
        size: info.size,
      };
    },

    async delete(key) {
      assertImageKey(key);
      const { unlink } = await import('node:fs/promises');
      const path = await resolveImagePath(root, key);
      try {
        await unlink(path);
      } catch (err) {
        // ENOENT is the postcondition this call exists to guarantee. Anything
        // else (EACCES, EIO, a read-only mount) must reach the caller.
        if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
          throw new ImageStorageError('Failed to delete image object from disk.', { cause: err });
        }
      }
    },

    // The key IS the path: img/logos/{uuid}.webp is served at /img/logos/{uuid}
    // .webp by app/img/[...key]/route.ts. Nothing to build, nothing to escape —
    // a key that passed assertImageKey() contains only [0-9a-f-/.] and the
    // three literal namespaces.
    publicUrl(key) {
      assertImageKey(key);
      return `/${key}`;
    },
  };
}

/**
 * root + key, with the result asserted to still be under root. The key pattern
 * already makes traversal impossible; this is the belt to that suspenders,
 * because the cost of being wrong is an arbitrary file read served publicly.
 */
async function resolveImagePath(root: string, key: string): Promise<string> {
  const { isAbsolute, resolve, sep } = await import('node:path');
  if (!isAbsolute(root)) {
    throw new ImageStorageError('IMAGE_STORAGE_DIR must be an absolute path.');
  }
  const base = resolve(root);
  const path = resolve(base, key);
  if (path !== base && !path.startsWith(base + sep)) {
    throw new ImageStorageError('Resolved image path escaped IMAGE_STORAGE_DIR.');
  }
  return path;
}

// ---------------------------------------------------------------------------
// R2 driver (S3-compatible, public-read bucket)
//
// Uploads and deletes are SigV4-signed with lib/storage.ts's signer — writing
// to the bucket is still an authenticated operation, and the credentials must
// be scoped to this bucket alone. Reads are not signed at all: the objects are
// public, which is the entire point, so the browser fetches them straight from
// IMAGE_R2_PUBLIC_BASE_URL and never touches this process.
//
// getStream() is therefore a convenience for parity (and for the disk-style
// route to keep working under either driver), not the read path.
// ---------------------------------------------------------------------------

export function createImageR2Driver(): ImageStorageDriver {
  const explicit = process.env.IMAGE_R2_ENDPOINT?.trim();
  const config: S3Config = {
    endpoint: explicit
      ? explicit.replace(/\/+$/, '')
      : `https://${requireEnv('IMAGE_R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    bucket: requireEnv('IMAGE_R2_BUCKET'),
    accessKeyId: requireEnv('IMAGE_R2_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('IMAGE_R2_SECRET_ACCESS_KEY'),
    // R2 ignores the region; SigV4 signs it, so both sides must agree. "auto"
    // is what Cloudflare documents.
    region: process.env.IMAGE_R2_REGION?.trim() || 'auto',
  };

  // Required at construction rather than at first render: a driver that can
  // store an image but cannot say where it lives is worse than one that refuses
  // to start, because the failure surfaces later and with the bytes already in.
  const publicBase = requireEnv('IMAGE_R2_PUBLIC_BASE_URL').replace(/\/+$/, '');
  if (!/^https:\/\//.test(publicBase)) {
    throw new ImageStorageError('IMAGE_R2_PUBLIC_BASE_URL must be an https:// URL.');
  }

  return {
    name: 'r2',

    async put(key, body) {
      assertImageKey(key);
      const response = await signedS3Fetch(config, 'PUT', key, {
        body,
        headers: { 'content-type': IMAGE_OUTPUT_MIME_TYPE },
      });
      await drain(response);
      if (!response.ok) {
        throw new ImageStorageError(`R2 rejected the image upload (HTTP ${response.status}).`);
      }
    },

    async getStream(key) {
      assertImageKey(key);
      const response = await signedS3Fetch(config, 'GET', key, {});
      if (!response.ok || !response.body) {
        await drain(response);
        throw new ImageStorageError(`R2 could not serve the image (HTTP ${response.status}).`);
      }
      const length = Number(response.headers.get('content-length'));
      return {
        body: response.body,
        size: Number.isFinite(length) && length > 0 ? length : null,
      };
    },

    async delete(key) {
      assertImageKey(key);
      const response = await signedS3Fetch(config, 'DELETE', key, {});
      await drain(response);
      // S3 semantics: 204 whether or not the object existed, which is the
      // postcondition we need. 404 is accepted for the same reason.
      if (!response.ok && response.status !== 404) {
        throw new ImageStorageError(`R2 refused to delete the image (HTTP ${response.status}).`);
      }
    },

    publicUrl(key) {
      assertImageKey(key);
      return `${publicBase}/${key}`;
    },
  };
}

/** Consume a body we are not going to read, so the socket can be reused. */
async function drain(response: Response): Promise<void> {
  try {
    await response.arrayBuffer();
  } catch {
    // A body we already decided to ignore failing to read is not news.
  }
}

// ---------------------------------------------------------------------------
// The two calls PR 19–21 actually make
// ---------------------------------------------------------------------------

export type StoredImage = {
  /** What goes in the database column. Never the URL — see the header note. */
  key: string;
  width: number;
  height: number;
  byteLength: number;
};

export type StoreImageResult =
  | ({ ok: true } & StoredImage)
  | { ok: false; reason: ImageRejection };

/**
 * Validate, convert, store. The whole pipeline in one call, so a consumer has
 * no reason to reach for processImage() and a driver separately — and so the
 * only bytes that can reach put() are the ones processImage() produced.
 *
 * Storage failures throw (an ImageStorageError is our problem, not the user's);
 * rejections come back as a reason with copy in IMAGE_REJECTION_MESSAGES.
 */
export async function storeImage(
  namespace: ImageNamespace,
  input: Uint8Array,
): Promise<StoreImageResult> {
  const processed = await processImage(namespace, input);
  if (!processed.ok) return processed;

  const key = buildImageKey(namespace);
  await getImageStorage().put(key, processed.bytes);

  return {
    ok: true,
    key,
    width: processed.width,
    height: processed.height,
    byteLength: processed.bytes.byteLength,
  };
}

/**
 * Delete the object. Callers do this BEFORE clearing the row that points at it,
 * and let the error propagate — same asymmetry as CVs (lib/storage.ts, bottom):
 * a row pointing at bytes that are gone renders one broken image, while an
 * object with no row pointing at it is a file nobody can ever remove.
 */
export async function deleteImage(key: string): Promise<void> {
  await getImageStorage().delete(key);
}

/** Where the browser fetches it. Site-relative under the disk driver. */
export function imagePublicUrl(key: string): string {
  return getImageStorage().publicUrl(key);
}
