// CV upload validation and download responses — PLAN-PHASE2.md §3.2 / §3.3.
//
// This module is the only place that decides whether a byte sequence is an
// acceptable CV, what it is called in storage, and how it reaches a browser.
// lib/storage.ts moves bytes; this file decides which bytes are allowed to
// move and who gets to see them come back.
//
// Three rules from the plan, implemented here rather than trusted to callers:
//
//   1. The file type is decided by MAGIC BYTES. Not by the client's
//      Content-Type (a header the uploader chooses) and not by the extension
//      (a substring of a filename the uploader chooses). A .pdf that is
//      actually an HTML page is a stored-XSS vector the moment anything ever
//      serves it inline; a .docx that is actually a zip bomb is a zip bomb.
//   2. 5 MB, enforced while the body streams in — the limit is checked per
//      chunk and the request is aborted mid-upload, so an attacker cannot make
//      this process buffer 500 MB before being told no.
//   3. The storage key is minted here as cv/{candidateId}/{uuid}.{ext}. The
//      user's filename is stored for display and never addresses a file.
//
// We never parse CV *contents*. Parsing is the first step down the road to
// "matching", which is Phase 4 and gated on legal review.
import 'server-only';

import { randomUUID } from 'node:crypto';

import { contentDisposition, getStorage } from './storage';

/** Hard limit. Not configurable: it is quoted in the candidate-facing copy. */
export const MAX_CV_BYTES = 5 * 1024 * 1024;

/** PLAN-PHASE2.md §3.3 — signed URLs live 60 seconds and are never stored. */
export const CV_SIGNED_URL_TTL_SECONDS = 60;

export type CvFileType = {
  extension: 'pdf' | 'doc' | 'docx';
  /** What we store in candidate_cvs.mime_type and serve back with. */
  mimeType: string;
};

const PDF_MIME = 'application/pdf';
const DOC_MIME = 'application/msword';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Human list for the Spanish error message and the file input's `accept`. */
export const ACCEPTED_CV_EXTENSIONS = ['.pdf', '.doc', '.docx'] as const;
export const ACCEPTED_CV_MIME_TYPES = [PDF_MIME, DOC_MIME, DOCX_MIME] as const;

// ---------------------------------------------------------------------------
// Magic-byte detection
// ---------------------------------------------------------------------------

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, i) => bytes[i] === byte);
}

/**
 * Byte-level indexOf over the whole buffer. Buffer.indexOf() rather than a JS
 * loop: this scans up to 5 MB on every upload and the native search is the
 * difference between microseconds and a visible pause.
 */
function contains(bytes: Uint8Array, needle: Uint8Array): boolean {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).indexOf(needle) !== -1;
}

function ascii(text: string): Uint8Array {
  return new Uint8Array([...text].map((c) => c.charCodeAt(0) & 0xff));
}

/** UTF-16LE, which is how a CFB directory stores its stream names. */
function utf16le(text: string): Uint8Array {
  const out = new Uint8Array(text.length * 2);
  for (let i = 0; i < text.length; i++) out[i * 2] = text.charCodeAt(i) & 0xff;
  return out;
}

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]; // PK\x03\x04
const CFB_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // OLE2

const DOCX_MARKER = ascii('word/document.xml');
const DOC_MARKER = utf16le('WordDocument');

/**
 * What this actually is, or null if it is not a CV we accept.
 *
 * The container signatures (ZIP, OLE2) are shared by formats we deliberately
 * reject — .xlsx and .odt are zips, .xls and .msi are OLE2 — so each one is
 * followed by a second check for the wordprocessing payload:
 *
 *   - DOCX: a zip entry named `word/document.xml`. Entry names sit in the
 *     archive's local headers and central directory uncompressed, so scanning
 *     the raw bytes finds it without unpacking anything.
 *   - DOC: a `WordDocument` stream in the compound-file directory, whose
 *     entries store names as UTF-16LE.
 *
 * Neither check parses the container. That matters: a parser is attack surface,
 * and a substring scan is not.
 */
export function detectCvFileType(bytes: Uint8Array): CvFileType | null {
  if (startsWith(bytes, PDF_SIGNATURE)) {
    return { extension: 'pdf', mimeType: PDF_MIME };
  }

  if (startsWith(bytes, ZIP_SIGNATURE) && contains(bytes, DOCX_MARKER)) {
    return { extension: 'docx', mimeType: DOCX_MIME };
  }

  if (startsWith(bytes, CFB_SIGNATURE) && contains(bytes, DOC_MARKER)) {
    return { extension: 'doc', mimeType: DOC_MIME };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Reading the upload
// ---------------------------------------------------------------------------

export type BodyReadResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: 'too_large' | 'empty' };

/**
 * Reads at most MAX_CV_BYTES from a Request body.
 *
 * Written against the Next 16 Route Handler contract (node_modules/next/dist/
 * docs/01-app/03-api-reference/03-file-conventions/route.md): a handler gets a
 * Web `Request`, so the body is a `ReadableStream` and there is no
 * `bodyParser.sizeLimit` config the way the Pages API routes had. Enforcement
 * is therefore ours to do, and doing it with `await request.arrayBuffer()`
 * followed by a length check would be no enforcement at all — the bytes are
 * already in memory by then.
 *
 * So: Content-Length is rejected first when it is present and over the limit
 * (cheap, and it stops the common case before a single chunk arrives), and the
 * stream is then read chunk by chunk with a running total. One byte over and
 * we cancel the stream, which closes the request. A lying or absent
 * Content-Length changes nothing, because the running total is the real gate.
 *
 * The upload is sent as a raw body rather than multipart/form-data on purpose:
 * `request.formData()` buffers the entire body before it returns anything, so
 * there is no chunk-level limit to enforce. PR 8's uploader posts the File
 * itself as the body with the filename in the X-CV-Filename header.
 */
export async function readLimitedBody(
  request: Request,
  maxBytes = MAX_CV_BYTES,
): Promise<BodyReadResult> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, reason: 'too_large' };
  }

  if (!request.body) return { ok: false, reason: 'empty' };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        return { ok: false, reason: 'too_large' };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (total === 0) return { ok: false, reason: 'empty' };

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}

// ---------------------------------------------------------------------------
// Keys and filenames
// ---------------------------------------------------------------------------

/**
 * cv/{candidateId}/{uuid}.{ext} — the shape lib/storage.ts asserts on every
 * call. The candidate id is a prefix rather than a lookup key: it makes a
 * bucket listing readable during an incident and makes "delete everything for
 * this candidate" a prefix operation, without ever being the thing that
 * authorises a download (that is always a DB row, never the key's shape).
 */
export function buildStorageKey(candidateId: number, extension: CvFileType['extension']): string {
  if (!Number.isInteger(candidateId) || candidateId <= 0) {
    throw new Error('buildStorageKey requires a positive candidate id.');
  }
  return `cv/${candidateId}/${randomUUID()}.${extension}`;
}

/**
 * The filename we keep for display. Untrusted: length-capped, stripped of path
 * separators and control characters so it can never be read as a path, and
 * given the extension the magic bytes actually say it is.
 */
export function sanitizeOriginalFilename(
  raw: string | null | undefined,
  extension: CvFileType['extension'],
): string {
  const base = (raw ?? '')
    // Control characters are stripped on purpose — a newline here is header injection.
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/]/g, '_')
    .trim()
    .slice(0, 200)
    .replace(/\.(pdf|doc|docx)$/i, '')
    .trim();
  const name = base.length > 0 ? base : 'cv';
  return `${name}.${extension}`;
}

// ---------------------------------------------------------------------------
// Serving a CV back
// ---------------------------------------------------------------------------

export type DownloadableCv = {
  storageKey: string;
  originalFilename: string;
  mimeType: string;
};

/**
 * The single response builder for all three download paths (§3.3). The paths
 * differ in *authorization*, which is each route's own job and is deliberately
 * not parameterised here — a shared "canAccess" argument is exactly the kind of
 * seam where a fourth caller passes `true`.
 *
 * On R2 this redirects to a 60-second presigned URL; on disk it streams the
 * file. That is the only place a caller can tell the drivers apart, and it is
 * why getSignedUrl() returns null rather than throwing on the disk driver.
 */
export async function cvDownloadResponse(cv: DownloadableCv): Promise<Response> {
  const storage = getStorage();

  const signedUrl = await storage.getSignedUrl(cv.storageKey, {
    expiresInSeconds: CV_SIGNED_URL_TTL_SECONDS,
    downloadFilename: cv.originalFilename,
  });

  if (signedUrl) {
    // 302, not 301: a permanent redirect to a URL that expires in a minute is
    // a cached broken link. Referrer-Policy keeps the signed URL out of the
    // Referer header of anything the browser loads next.
    return new Response(null, {
      status: 302,
      headers: {
        location: signedUrl,
        'cache-control': 'private, no-store, max-age=0',
        'referrer-policy': 'no-referrer',
      },
    });
  }

  const { body, size } = await storage.getStream(cv.storageKey);
  const headers = new Headers({
    'content-type': cv.mimeType,
    'content-disposition': contentDisposition(cv.originalFilename),
    // Never inline, never sniffed, never cached by a proxy. A CV is the most
    // personal thing this application stores.
    'x-content-type-options': 'nosniff',
    'cache-control': 'private, no-store, max-age=0',
    'referrer-policy': 'no-referrer',
  });
  if (size !== null) headers.set('content-length', String(size));

  return new Response(body, { status: 200, headers });
}
