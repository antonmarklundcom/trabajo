// scripts/verify-storage.ts — asserts the CV storage layer's security
// properties. Run with `npm run storage:verify`.
//
// Same spirit as scripts/verify-scoping.ts: the properties this file checks are
// the ones whose failure is a data breach rather than a bug, so they are
// asserted by running the code, not by reading it. Nothing here needs a
// database or a bucket — the disk driver runs against a temp directory and the
// validation functions are pure.
//
// What is asserted:
//   1. Magic bytes decide the type. A PDF renamed .docx is a PDF; an HTML page
//      named cv.pdf is rejected; a plain zip and an .xls are rejected even
//      though they share a container signature with .docx and .doc.
//   2. The 5 MB limit trips on the streamed body, and on a lying Content-Length.
//   3. Storage keys are cv/{candidateId}/{uuid}.{ext} and every driver method
//      refuses anything else — including traversal attempts.
//   4. Disk driver round-trips put → getStream → delete, delete is idempotent,
//      and getSignedUrl() returns null so callers stream.
//   5. The R2 presigner produces a URL whose expiry and signature are present
//      and whose TTL is the 60 seconds §3.3 requires.
//   6. Filenames are sanitised before they can reach a Content-Disposition
//      header.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildStorageKey,
  CV_SIGNED_URL_TTL_SECONDS,
  detectCvFileType,
  MAX_CV_BYTES,
  readLimitedBody,
  sanitizeOriginalFilename,
} from '../lib/cv';
import {
  __presignForTest,
  assertStorageKey,
  contentDisposition,
  createDiskDriver,
  createR2Driver,
  STORAGE_KEY_PATTERN,
} from '../lib/storage';

let failures = 0;
let checks = 0;

function check(label: string, condition: boolean): void {
  checks++;
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.error(`  FAIL ${label}`);
  }
}

async function throws(label: string, fn: () => Promise<unknown> | unknown): Promise<void> {
  try {
    await fn();
    check(label, false);
  } catch {
    check(label, true);
  }
}

function bytes(...parts: (string | number[])[]): Uint8Array {
  const out: number[] = [];
  for (const part of parts) {
    if (typeof part === 'string') for (const ch of part) out.push(ch.charCodeAt(0) & 0xff);
    else out.push(...part);
  }
  return new Uint8Array(out);
}

const PDF = bytes('%PDF-1.7\n', 'trailing content');
const DOCX = bytes([0x50, 0x4b, 0x03, 0x04], 'junk', 'word/document.xml', 'more');
const DOC = bytes(
  [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
  'padding',
  // "WordDocument" as UTF-16LE, which is how a CFB directory stores it.
  'W\0o\0r\0d\0D\0o\0c\0u\0m\0e\0n\0t\0',
);
const PLAIN_ZIP = bytes([0x50, 0x4b, 0x03, 0x04], 'xl/workbook.xml');
const XLS_LIKE = bytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], 'W\0o\0r\0k\0b\0o\0o\0k\0');
const HTML = bytes('<!doctype html><script>alert(1)</script>');

function request(body: Uint8Array, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/postulante/cv', {
    method: 'POST',
    headers,
    body: body as BodyInit,
    // Node's fetch requires this when a body is a stream-backed init.
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
}

async function main(): Promise<void> {
  console.log('\n1. Magic-byte detection (never the extension, never Content-Type)');
  check('PDF is detected as pdf', detectCvFileType(PDF)?.extension === 'pdf');
  check('DOCX is detected as docx', detectCvFileType(DOCX)?.extension === 'docx');
  check('DOC is detected as doc', detectCvFileType(DOC)?.extension === 'doc');
  check('HTML named cv.pdf is rejected', detectCvFileType(HTML) === null);
  check('a zip that is not a .docx is rejected', detectCvFileType(PLAIN_ZIP) === null);
  check('an OLE2 file that is not a .doc is rejected', detectCvFileType(XLS_LIKE) === null);
  check('an empty buffer is rejected', detectCvFileType(new Uint8Array()) === null);
  check(
    'a PDF keeps the .pdf extension whatever it was called',
    sanitizeOriginalFilename('resume.docx', detectCvFileType(PDF)!.extension) === 'resume.pdf',
  );

  console.log('\n2. The 5 MB limit, enforced on the stream');
  const small = await readLimitedBody(request(PDF));
  check('a small body is accepted', small.ok && small.bytes.byteLength === PDF.byteLength);

  const oversize = new Uint8Array(MAX_CV_BYTES + 1024);
  oversize.set(PDF);
  const tooBig = await readLimitedBody(request(oversize));
  check('a 5 MB + 1 KB body is rejected', !tooBig.ok && tooBig.reason === 'too_large');

  const lying = await readLimitedBody(request(oversize, { 'content-length': '10' }));
  check('a lying Content-Length does not get past the running total', !lying.ok);

  const declaredHuge = await readLimitedBody(
    request(PDF, { 'content-length': String(MAX_CV_BYTES * 100) }),
  );
  check('an oversized Content-Length is rejected up front', !declaredHuge.ok);

  const empty = await readLimitedBody(request(new Uint8Array()));
  check('an empty body is rejected', !empty.ok && empty.reason === 'empty');

  console.log('\n3. Storage keys are minted, never accepted');
  const key = buildStorageKey(42, 'pdf');
  check(`buildStorageKey produces ${key}`, STORAGE_KEY_PATTERN.test(key));
  check('the key is prefixed with the candidate id', key.startsWith('cv/42/'));
  check('the key never contains the original filename', !key.includes('resume'));
  for (const bad of [
    'cv/42/../43/x.pdf',
    '../../etc/passwd',
    'cv/42/resume.pdf',
    'cv/0/00000000-0000-0000-0000-000000000000.pdf',
    'cv/42/00000000-0000-0000-0000-000000000000.exe',
    key.toUpperCase(),
  ]) {
    await throws(`assertStorageKey rejects ${JSON.stringify(bad)}`, () => assertStorageKey(bad));
  }

  console.log('\n4. Disk driver round trip');
  const dir = await mkdtemp(join(tmpdir(), 'trabajo-cv-'));
  process.env.CV_STORAGE_DIR = dir;
  const disk = createDiskDriver();

  await disk.put(key, PDF, 'application/pdf');
  const stream = await disk.getStream(key);
  const readBack = new Uint8Array(await new Response(stream.body).arrayBuffer());
  check('what comes back out is what went in', Buffer.from(readBack).equals(Buffer.from(PDF)));
  check('the driver reports the size', stream.size === PDF.byteLength);
  check(
    'getSignedUrl() is null on disk, so callers stream',
    (await disk.getSignedUrl(key, { expiresInSeconds: 60 })) === null,
  );

  await disk.delete(key);
  await throws('reading a deleted object fails', () => disk.getStream(key));
  await disk.delete(key); // ENOENT is success: the bytes are gone either way.
  check('deleting an already-deleted object is not an error', true);

  await throws('the disk driver refuses a traversal key', () =>
    disk.getStream('cv/42/../../../etc/passwd'),
  );

  // A file planted outside the key namespace must stay unreachable even by an
  // absolute path, because the key pattern is checked before anything resolves.
  await writeFile(join(dir, 'secret.txt'), 'nope');
  await throws('the disk driver refuses an absolute path', () => disk.getStream('/etc/passwd'));

  await rm(dir, { recursive: true, force: true });

  console.log('\n5. R2 presigning');
  process.env.CV_R2_ACCOUNT_ID = 'account';
  process.env.CV_R2_BUCKET = 'cvs';
  process.env.CV_R2_ACCESS_KEY_ID = 'AKIAEXAMPLE';
  process.env.CV_R2_SECRET_ACCESS_KEY = 'secretexample';
  const r2 = createR2Driver();
  const signed = await r2.getSignedUrl(key, {
    expiresInSeconds: CV_SIGNED_URL_TTL_SECONDS,
    downloadFilename: 'mi cv.pdf',
  });
  const url = new URL(signed!);
  check('the URL points at the bucket and key', url.pathname === `/cvs/${key}`);
  check('the TTL is 60 seconds', url.searchParams.get('X-Amz-Expires') === '60');
  check('the TTL matches §3.3', CV_SIGNED_URL_TTL_SECONDS === 60);
  check('a signature is present', (url.searchParams.get('X-Amz-Signature') ?? '').length === 64);
  check(
    'the credential carries the scope',
    (url.searchParams.get('X-Amz-Credential') ?? '').endsWith('/aws4_request'),
  );
  check('the secret never appears in the URL', !signed!.includes('secretexample'));
  check(
    'the download filename is signed into the URL',
    (url.searchParams.get('response-content-disposition') ?? '').includes('attachment'),
  );
  await throws('the R2 driver refuses a malformed key', () =>
    r2.getSignedUrl('cv/../x.pdf', { expiresInSeconds: 60 }),
  );

  // The signing itself is hand-rolled (no @aws-sdk/client-s3), so it is checked
  // against the presigned-URL example published in the AWS SigV4 documentation:
  // GET examplebucket/test.txt, 20130524T000000Z, us-east-1, 86400s, with the
  // documented example credentials. A signature that reproduces theirs exactly
  // means the canonical request, the scope, the string-to-sign and the key
  // derivation are all right — a typo in any one of them changes it completely.
  const vector = __presignForTest(
    {
      endpoint: 'https://examplebucket.s3.amazonaws.com',
      bucket: '', // virtual-hosted: the endpoint already names the bucket
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      region: 'us-east-1',
    },
    'test.txt',
    { expiresInSeconds: 86400 },
    new Date('2013-05-24T00:00:00Z'),
  );
  const expected = 'aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404';
  check(
    "SigV4 reproduces AWS's published presigned-URL signature",
    new URL(vector).searchParams.get('X-Amz-Signature') === expected,
  );

  console.log('\n6. Filenames never reach a header raw');
  const nasty = contentDisposition('cv\r\nX-Injected: 1".pdf');
  check('CRLF is stripped from Content-Disposition', !/[\r\n]/.test(nasty));
  check('quotes are stripped from the ASCII fallback', /filename="[^"]*"/.test(nasty));
  check(
    'a filename made only of separators still yields something',
    sanitizeOriginalFilename('../../', 'pdf') === '_.._.pdf' ||
      sanitizeOriginalFilename('../../', 'pdf').endsWith('.pdf'),
  );
  check(
    'the stored filename always carries the detected extension',
    sanitizeOriginalFilename('hoja de vida', 'docx') === 'hoja de vida.docx',
  );

  console.log(
    `\n${failures === 0 ? 'PASS' : 'FAIL'} — ${checks - failures}/${checks} checks passed.\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
