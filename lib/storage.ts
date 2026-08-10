// CV object storage — the bytes behind `candidate_cvs.storage_key`.
//
// PLAN-PHASE2.md §3.1: two drivers behind one interface, selected by
// CV_STORAGE_DRIVER=r2|disk. R2 is the recommendation (a private bucket, not a
// service to operate, and it survives a deploy); disk is the fallback for "no
// new services", writing to a CV_STORAGE_DIR *outside* the build root because
// Hostinger replaces `public_html/.builds/last-source/` on every deploy
// (DEPLOY.md) and anything inside it is destroyed by the next merge to main.
//
// Choosing later is an env var, not a rewrite — the same seam trick that made
// the WordPress swap cheap. Nothing above this file knows which driver is live;
// the one place the difference is visible is getSignedUrl(), which returns null
// on disk so the caller streams instead of redirecting.
//
// Why no @aws-sdk/client-s3: the four operations below are one signed HTTPS
// request each, and the SDK is ~20 MB of dependency on a shared Hostinger plan
// for that. SigV4 is implemented here against the documented algorithm, with
// the canonical request written out step by step so it can be reviewed rather
// than trusted.
//
// SECURITY INVARIANT: every method asserts its key against STORAGE_KEY_PATTERN
// before touching a filesystem or a bucket. Keys are minted by buildStorageKey()
// (lib/cv.ts) and are never derived from user input, but a driver that validates
// makes path traversal unrepresentable rather than merely absent.
import 'server-only';

import { createHash, createHmac } from 'node:crypto';

/** The only shape a CV key may have: cv/{candidateId}/{uuid}.{ext}. */
export const STORAGE_KEY_PATTERN =
  /^cv\/[1-9][0-9]{0,9}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:pdf|doc|docx)$/;

export class StorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StorageError';
  }
}

export function assertStorageKey(key: string): void {
  if (!STORAGE_KEY_PATTERN.test(key)) {
    // Deliberately does not echo the key: this only fires on a bug or an
    // attack, and in the second case the log line is attacker-controlled.
    throw new StorageError('Refusing to address storage with a malformed key.');
  }
}

export type SignedUrlOptions = {
  /** Seconds the URL stays valid. Callers use CV_SIGNED_URL_TTL_SECONDS. */
  expiresInSeconds: number;
  /** Sanitised ASCII filename for Content-Disposition, or undefined. */
  downloadFilename?: string;
};

export type StorageStream = {
  body: ReadableStream<Uint8Array>;
  /** Bytes, when the driver knows it up front. */
  size: number | null;
};

export interface StorageDriver {
  readonly name: 'r2' | 'disk';
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  /**
   * A short-lived URL the browser can fetch directly, or **null** when the
   * driver has no such concept (disk). Never persisted — PLAN-PHASE2.md §3.3.
   */
  getSignedUrl(key: string, options: SignedUrlOptions): Promise<string | null>;
  getStream(key: string): Promise<StorageStream>;
  /** Throws on failure. See the note on deletion at the bottom of this file. */
  delete(key: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Content-Disposition
//
// The original filename is untrusted input and must never reach a response
// header as-is: a newline in it is header injection, and a quote breaks out of
// the filename parameter. We emit a conservative ASCII fallback plus RFC 5987
// filename* for the real thing, which is what browsers actually read.
// ---------------------------------------------------------------------------

export function contentDisposition(filename: string): string {
  const ascii = filename
    // Control characters are stripped on purpose — a newline here is header injection.
    .replace(/[\u0000-\u001f\u007f"\\]/g, '')
    .replace(/[^\x20-\x7e]/g, '_')
    .slice(0, 120)
    .trim();
  const safe = ascii.length > 0 ? ascii : 'cv';
  return `attachment; filename="${safe}"; filename*=UTF-8''${encodeRfc3986(filename.slice(0, 120))}`;
}

// ---------------------------------------------------------------------------
// Driver selection
// ---------------------------------------------------------------------------

let cached: StorageDriver | null = null;

/**
 * The configured driver. Memoized per process, not per request — the config it
 * reads is env, which cannot change under a running Node process.
 *
 * Fails loudly on an unknown value rather than defaulting: silently falling
 * back to disk when someone typos "r2 " would write CVs into a directory that
 * the next deploy deletes, and nobody would notice until a candidate asked for
 * their file back.
 */
export function getStorage(): StorageDriver {
  if (cached) return cached;

  const configured = process.env.CV_STORAGE_DRIVER?.trim().toLowerCase();
  if (configured === 'r2') cached = createR2Driver();
  else if (configured === 'disk') cached = createDiskDriver();
  else {
    throw new StorageError(
      `CV_STORAGE_DRIVER must be "r2" or "disk" (got ${configured ? `"${configured}"` : 'nothing'}). ` +
        'See .env.example — there is no default on purpose.',
    );
  }

  return cached;
}

/** Test/script hook. Never called from the app. */
export function resetStorageForTesting(): void {
  cached = null;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new StorageError(`${name} is required by the configured CV_STORAGE_DRIVER.`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Disk driver
// ---------------------------------------------------------------------------

export function createDiskDriver(): StorageDriver {
  const root = requireEnv('CV_STORAGE_DIR');

  return {
    name: 'disk',

    async put(key, body) {
      assertStorageKey(key);
      const { mkdir, writeFile } = await import('node:fs/promises');
      const path = await resolveDiskPath(root, key);
      const { dirname } = await import('node:path');
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      // 0600: on shared hosting the only account that needs to read these is
      // the one running the app.
      await writeFile(path, body, { mode: 0o600, flag: 'wx' });
    },

    // No such thing on a filesystem. The route streams instead — the one place
    // the two drivers differ above this file.
    async getSignedUrl() {
      return null;
    },

    async getStream(key) {
      assertStorageKey(key);
      const { stat } = await import('node:fs/promises');
      const { createReadStream } = await import('node:fs');
      const { Readable } = await import('node:stream');
      const path = await resolveDiskPath(root, key);

      const info = await stat(path).catch(() => null);
      if (!info?.isFile()) throw new StorageError('CV object not found on disk.');

      return {
        body: Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>,
        size: info.size,
      };
    },

    async delete(key) {
      assertStorageKey(key);
      const { unlink } = await import('node:fs/promises');
      const path = await resolveDiskPath(root, key);
      try {
        await unlink(path);
      } catch (err) {
        // ENOENT means the bytes are already gone, which is the postcondition
        // this call exists to guarantee — the DB row may now safely follow.
        // Anything else (EACCES, EIO, a read-only mount) must NOT be swallowed:
        // see the deletion note at the bottom of this file.
        if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
          throw new StorageError(`Failed to delete CV object from disk.`, { cause: err });
        }
      }
    },
  };
}

/**
 * root + key, with the result asserted to still be under root. The key pattern
 * already makes traversal impossible; this is the belt to that suspenders,
 * because the cost of being wrong here is arbitrary file read or unlink.
 */
async function resolveDiskPath(root: string, key: string): Promise<string> {
  const { isAbsolute, resolve, sep } = await import('node:path');
  if (!isAbsolute(root)) {
    throw new StorageError('CV_STORAGE_DIR must be an absolute path.');
  }
  const base = resolve(root);
  const path = resolve(base, key);
  if (path !== base && !path.startsWith(base + sep)) {
    throw new StorageError('Resolved CV path escaped CV_STORAGE_DIR.');
  }
  return path;
}

// ---------------------------------------------------------------------------
// R2 driver (S3-compatible, SigV4)
// ---------------------------------------------------------------------------

/**
 * Everything the signer needs. Exported because lib/image-storage.ts drives its
 * own bucket through signedS3Fetch() below rather than reimplementing SigV4 —
 * one hand-rolled signer in this repo is one that can be reviewed and pinned to
 * the AWS test vector; two is two.
 */
export type S3Config = {
  endpoint: string; // https://<account>.r2.cloudflarestorage.com
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
};

function r2Config(): S3Config {
  const explicit = process.env.CV_R2_ENDPOINT?.trim();
  const endpoint = explicit
    ? explicit.replace(/\/+$/, '')
    : `https://${requireEnv('CV_R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`;

  return {
    endpoint,
    bucket: requireEnv('CV_R2_BUCKET'),
    accessKeyId: requireEnv('CV_R2_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('CV_R2_SECRET_ACCESS_KEY'),
    // R2 ignores the region but SigV4 does not: it is part of the scope string
    // on both sides, so it has to match what the signer used. "auto" is what
    // Cloudflare documents.
    region: process.env.CV_R2_REGION?.trim() || 'auto',
  };
}

export function createR2Driver(): StorageDriver {
  const config = r2Config();

  return {
    name: 'r2',

    async put(key, body, contentType) {
      assertStorageKey(key);
      const response = await signedS3Fetch(config, 'PUT', key, {
        body,
        headers: { 'content-type': contentType },
      });
      await drain(response);
      if (!response.ok) {
        throw new StorageError(`R2 rejected the upload (HTTP ${response.status}).`);
      }
    },

    async getSignedUrl(key, options) {
      assertStorageKey(key);
      return presignGet(config, key, options);
    },

    async getStream(key) {
      assertStorageKey(key);
      const response = await signedS3Fetch(config, 'GET', key, {});
      if (!response.ok || !response.body) {
        await drain(response);
        throw new StorageError(`R2 could not serve the CV object (HTTP ${response.status}).`);
      }
      const length = Number(response.headers.get('content-length'));
      return {
        body: response.body,
        size: Number.isFinite(length) && length > 0 ? length : null,
      };
    },

    async delete(key) {
      assertStorageKey(key);
      const response = await signedS3Fetch(config, 'DELETE', key, {});
      await drain(response);
      // S3 semantics: 204 whether or not the object existed, which is exactly
      // the postcondition we need. 404 is accepted for the same reason. Any
      // other status is a real failure and must reach the caller.
      if (!response.ok && response.status !== 404) {
        throw new StorageError(`R2 refused to delete the CV object (HTTP ${response.status}).`);
      }
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
// AWS Signature Version 4
//
// Implemented from the documented algorithm rather than pulled in as a
// dependency (see the header note). Two flavours are needed:
//   - header signing, for the PUT/GET/DELETE this process makes itself;
//   - query signing (presigning), for the 60-second URL the browser follows.
// ---------------------------------------------------------------------------

const ALGORITHM = 'AWS4-HMAC-SHA256';
const SERVICE = 's3';
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function sha256Hex(data: Uint8Array | string): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmac(key: Uint8Array | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

/** RFC 3986, which is stricter than encodeURIComponent about !'()* */
function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** Each path segment is encoded; the separators are not. */
function canonicalPath(bucket: string, key: string): string {
  // Path style (/{bucket}/{key}), which is what R2's endpoint speaks. An empty
  // bucket means the endpoint already addresses one (virtual-hosted style) —
  // used only by the AWS test vector in scripts/verify-storage.ts.
  const segments = bucket ? [bucket, ...key.split('/')] : key.split('/');
  return `/${segments.map(encodeRfc3986).join('/')}`;
}

function amzDates(now: Date): { amzDate: string; dateStamp: string } {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

function signingKey(config: S3Config, dateStamp: string): Buffer {
  return hmac(
    hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, dateStamp), config.region), SERVICE),
    'aws4_request',
  );
}

function credentialScope(config: S3Config, dateStamp: string): string {
  return `${dateStamp}/${config.region}/${SERVICE}/aws4_request`;
}

function stringToSign(amzDate: string, scope: string, canonicalRequest: string): string {
  return [ALGORITHM, amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
}

export async function signedS3Fetch(
  config: S3Config,
  method: 'GET' | 'PUT' | 'DELETE',
  key: string,
  init: { body?: Uint8Array; headers?: Record<string, string> },
): Promise<Response> {
  const url = new URL(config.endpoint);
  const { amzDate, dateStamp } = amzDates(new Date());
  const payloadHash = init.body ? sha256Hex(init.body) : EMPTY_SHA256;

  const headers: Record<string, string> = {
    ...(init.headers ?? {}),
    host: url.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };

  const sortedNames = Object.keys(headers)
    .map((name) => name.toLowerCase())
    .sort();
  const canonicalHeaders = sortedNames
    .map((name) => `${name}:${headers[name]!.trim().replace(/\s+/g, ' ')}\n`)
    .join('');
  const signedHeaders = sortedNames.join(';');

  const canonicalRequest = [
    method,
    canonicalPath(config.bucket, key),
    '', // no query string on the header-signed calls
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const scope = credentialScope(config, dateStamp);
  const signature = hmac(
    signingKey(config, dateStamp),
    stringToSign(amzDate, scope, canonicalRequest),
  ).toString('hex');

  return fetch(`${config.endpoint}${canonicalPath(config.bucket, key)}`, {
    method,
    headers: {
      ...headers,
      authorization:
        `${ALGORITHM} Credential=${config.accessKeyId}/${scope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body: init.body as BodyInit | undefined,
    // Never let a CV fetch be served from any cache, ours or an intermediary's.
    cache: 'no-store',
  });
}

/**
 * A presigned GET. `host` is the only signed header, so the browser can follow
 * the URL with nothing but the query string — and the signature covers the
 * expiry, so it cannot be extended by editing the link.
 */
function presignGet(
  config: S3Config,
  key: string,
  options: SignedUrlOptions,
  now = new Date(),
): string {
  const url = new URL(config.endpoint);
  const { amzDate, dateStamp } = amzDates(now);
  const scope = credentialScope(config, dateStamp);

  const query: Record<string, string> = {
    'X-Amz-Algorithm': ALGORITHM,
    'X-Amz-Credential': `${config.accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(options.expiresInSeconds),
    'X-Amz-SignedHeaders': 'host',
  };
  if (options.downloadFilename) {
    // Signed, so it cannot be swapped for something else by whoever holds the
    // link — and sanitised by contentDisposition() before it gets here.
    query['response-content-disposition'] = contentDisposition(options.downloadFilename);
  }

  const canonicalQuery = Object.keys(query)
    .sort()
    .map((name) => `${encodeRfc3986(name)}=${encodeRfc3986(query[name]!)}`)
    .join('&');

  const canonicalRequest = [
    'GET',
    canonicalPath(config.bucket, key),
    canonicalQuery,
    `host:${url.host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const signature = hmac(
    signingKey(config, dateStamp),
    stringToSign(amzDate, scope, canonicalRequest),
  ).toString('hex');

  return `${config.endpoint}${canonicalPath(config.bucket, key)}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

// ---------------------------------------------------------------------------
// A note on deletion (PLAN-PHASE2.md §3.4)
//
// Callers must call storage.delete() BEFORE touching the DB row, and must let
// a StorageError propagate rather than continuing. The asymmetry is the whole
// point: an orphaned DB row pointing at bytes that are already gone is
// recoverable bookkeeping, while an orphaned object with no row pointing at it
// is a CV we can no longer find when the candidate exercises their ARCO
// cancellation. The ordering is enforced in lib/db/candidate-cvs.ts, which is
// the only module that deletes candidate_cvs rows.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Test hook
//
// Hand-rolled request signing is only trustworthy if it is checked against
// something authoritative, so scripts/verify-storage.ts reproduces the
// presigned-URL example published in the AWS SigV4 documentation and compares
// the signature byte for byte. That needs a fixed clock and a config that is
// not read from env, which is all this export provides. Nothing in the app
// calls it.
// ---------------------------------------------------------------------------

export function __presignForTest(
  config: {
    endpoint: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  },
  key: string,
  options: SignedUrlOptions,
  now: Date,
): string {
  return presignGet(config, key, options, now);
}
