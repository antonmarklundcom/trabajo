// scripts/verify-image-storage.ts — asserts the public image pipeline's
// security properties. Run with `npm run image-storage:verify`.
//
// Same spirit as scripts/verify-storage.ts, inverted threat model: the failure
// this suite exists to prevent is not a leaked file but a hosted one — an
// attacker's bytes served from our own origin. Nothing here needs a database or
// a bucket; the disk driver runs against a temp directory and the rest is pure
// or sharp.
//
// What is asserted:
//   1. Magic bytes decide the type, and the accepted list is JPEG/PNG/WebP.
//      SVG, GIF, HTML and a PDF renamed .png are all rejected.
//   2. The 4 MB limit trips on the streamed body and on a lying Content-Length.
//   3. Keys are minted, never accepted: traversal, absolute paths, foreign
//      namespaces and non-.webp extensions are refused by every driver method
//      and by the segment parser the public route feeds.
//   4. Conversion: everything comes out WebP, oversized images are resized to
//      the namespace cap, EXIF (where the GPS is) does not survive, a polyglot
//      keeps none of its original bytes, decompression-bomb dimensions are
//      refused before decode, and animations are refused.
//   5. Disk driver round trip, idempotent delete, and a site-relative public URL
//      that is exactly the key.
//   6. R2 driver: public URLs on the configured domain, malformed keys refused,
//      and a missing public base URL fails at construction rather than later.
import { crc32 } from 'node:zlib';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import sharp from 'sharp';

import {
  buildImageKey,
  createImageDiskDriver,
  createImageR2Driver,
  detectImageFileType,
  IMAGE_NAMESPACE_MAX_DIMENSION,
  IMAGE_STORAGE_KEY_PATTERN,
  imageKeyFromSegments,
  MAX_IMAGE_INPUT_PIXELS,
  MAX_IMAGE_UPLOAD_BYTES,
  processImage,
  readLimitedImageBody,
  assertImageKey,
} from '../lib/image-storage';

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

function request(body: Uint8Array, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/empresa/logo', {
    method: 'POST',
    headers,
    body: body as BodyInit,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
}

/**
 * A PNG that *declares* `width × height` and carries no pixel data. This is the
 * decompression bomb in its cheapest form: a few dozen bytes on the wire that
 * ask a decoder to allocate width × height × 4 bytes of memory. Hand-built
 * rather than produced by sharp precisely because sharp would have to allocate
 * the thing we are refusing to allocate.
 */
function pngHeaderOnly(width: number, height: number): Uint8Array {
  const ihdr = Buffer.alloc(17);
  ihdr.write('IHDR', 0, 'ascii');
  ihdr.writeUInt32BE(width, 4);
  ihdr.writeUInt32BE(height, 8);
  ihdr[12] = 8; // bit depth
  ihdr[13] = 2; // colour type: truecolour
  const chunk = Buffer.concat([
    Buffer.from([0, 0, 0, 13]), // IHDR payload length
    ihdr,
    (() => {
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(crc32(ihdr) >>> 0, 0);
      return crc;
    })(),
  ]);
  return new Uint8Array(
    Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk]),
  );
}

function riffChunk(fourcc: string, payload: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.write(fourcc, 0, 'ascii');
  header.writeUInt32LE(payload.length, 4);
  // RIFF chunks are padded to an even length.
  const pad = payload.length % 2 === 1 ? Buffer.from([0]) : Buffer.alloc(0);
  return Buffer.concat([header, payload, pad]);
}

function u24(value: number): Buffer {
  const out = Buffer.alloc(3);
  out.writeUIntLE(value, 0, 3);
  return out;
}

/**
 * An animated WebP with `frames` frames, assembled by hand from a still one.
 *
 * sharp cannot be asked to produce this (its animation support is on the input
 * side), and that is fitting: an attacker probing for a frame-count bomb writes
 * the container by hand too. The still image's VP8 bitstream is reused for every
 * frame, so the file stays tiny while the frame count is whatever we say — which
 * is exactly the property MAX_IMAGE_INPUT_PIXELS does not bound and the `pages`
 * check does.
 */
function animatedWebp(still: Uint8Array, size: number, frames: number): Uint8Array {
  const source = Buffer.from(still);
  const at = source.indexOf('VP8 ', 12, 'ascii');
  const length = source.readUInt32LE(at + 4);
  const vp8 = source.subarray(at, at + 8 + length + (length % 2));

  const body = Buffer.concat([
    Buffer.from('WEBP', 'ascii'),
    // VP8X: the ANIMATION flag plus the canvas size, each dimension minus one.
    riffChunk('VP8X', Buffer.concat([Buffer.from([0x02, 0, 0, 0]), u24(size - 1), u24(size - 1)])),
    // ANIM: background colour + loop count.
    riffChunk('ANIM', Buffer.from([0, 0, 0, 0, 0, 0])),
    ...Array.from({ length: frames }, () =>
      riffChunk(
        'ANMF',
        Buffer.concat([
          u24(0),
          u24(0),
          u24(size - 1),
          u24(size - 1),
          u24(100), // frame duration, ms
          Buffer.from([0]),
          vp8,
        ]),
      ),
    ),
  ]);

  const riff = Buffer.alloc(8);
  riff.write('RIFF', 0, 'ascii');
  riff.writeUInt32LE(body.length, 4);
  return new Uint8Array(Buffer.concat([riff, body]));
}

const SVG = bytes('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const HTML = bytes('<!doctype html><script>alert(1)</script>');
const PDF = bytes('%PDF-1.7\n', 'trailing content');
const GIF = bytes('GIF89a', [0x01, 0x00, 0x01, 0x00]);
const WAV = bytes('RIFF', [0x24, 0x00, 0x00, 0x00], 'WAVEfmt ');

async function main(): Promise<void> {
  const PNG = new Uint8Array(
    await sharp({
      create: { width: 40, height: 30, channels: 3, background: { r: 200, g: 30, b: 30 } },
    })
      .png()
      .toBuffer(),
  );
  const JPEG = new Uint8Array(
    await sharp({
      create: { width: 40, height: 30, channels: 3, background: { r: 30, g: 200, b: 30 } },
    })
      .jpeg()
      .toBuffer(),
  );
  const WEBP = new Uint8Array(
    await sharp({
      create: { width: 40, height: 30, channels: 3, background: { r: 30, g: 30, b: 200 } },
    })
      .webp()
      .toBuffer(),
  );

  console.log('\n1. Magic-byte detection (never the extension, never Content-Type)');
  check('PNG is detected as png', detectImageFileType(PNG)?.format === 'png');
  check('JPEG is detected as jpeg', detectImageFileType(JPEG)?.format === 'jpeg');
  check('WebP is detected as webp', detectImageFileType(WEBP)?.format === 'webp');
  check('an SVG is rejected — it is a script container', detectImageFileType(SVG) === null);
  check('an HTML page named logo.png is rejected', detectImageFileType(HTML) === null);
  check('a PDF is rejected', detectImageFileType(PDF) === null);
  check('a GIF is rejected (deliberate, see lib/image-storage.ts)', detectImageFileType(GIF) === null);
  check('a WAV is rejected even though it is also RIFF', detectImageFileType(WAV) === null);
  check('an empty buffer is rejected', detectImageFileType(new Uint8Array()) === null);
  check(
    'the detected type comes from the bytes, not the declared one',
    detectImageFileType(PNG)?.mimeType === 'image/png',
  );

  console.log('\n2. The 4 MB limit, enforced on the stream');
  const small = await readLimitedImageBody(request(PNG));
  check('a small body is accepted', small.ok && small.bytes.byteLength === PNG.byteLength);

  const oversize = new Uint8Array(MAX_IMAGE_UPLOAD_BYTES + 1024);
  oversize.set(PNG);
  const tooBig = await readLimitedImageBody(request(oversize));
  check('a 4 MB + 1 KB body is rejected', !tooBig.ok && tooBig.reason === 'too_large');

  const lying = await readLimitedImageBody(request(oversize, { 'content-length': '10' }));
  check('a lying Content-Length does not get past the running total', !lying.ok);

  const declaredHuge = await readLimitedImageBody(
    request(PNG, { 'content-length': String(MAX_IMAGE_UPLOAD_BYTES * 100) }),
  );
  check('an oversized Content-Length is rejected up front', !declaredHuge.ok);

  const empty = await readLimitedImageBody(request(new Uint8Array()));
  check('an empty body is rejected', !empty.ok && empty.reason === 'empty');

  check('the image limit is below the CV limit', MAX_IMAGE_UPLOAD_BYTES < 5 * 1024 * 1024);

  console.log('\n3. Keys are minted, never accepted');
  const key = buildImageKey('logos');
  check(`buildImageKey produces ${key}`, IMAGE_STORAGE_KEY_PATTERN.test(key));
  check('the key is namespaced', key.startsWith('img/logos/'));
  check('two keys never collide', buildImageKey('logos') !== buildImageKey('logos'));
  await throws('an unknown namespace is refused', () =>
    // The union makes this unreachable from typed code; the runtime guard is
    // what protects the pattern if a future caller casts.
    buildImageKey('../../etc' as never),
  );

  for (const bad of [
    'img/logos/../blog/00000000-0000-0000-0000-000000000000.webp',
    '../../etc/passwd',
    '/etc/passwd',
    'img/logos/logo.webp',
    'img/cv/00000000-0000-0000-0000-000000000000.webp',
    'cv/1/00000000-0000-0000-0000-000000000000.pdf',
    'img/logos/00000000-0000-0000-0000-000000000000.svg',
    'img/logos/00000000-0000-0000-0000-000000000000.webp.html',
    key.toUpperCase(),
  ]) {
    await throws(`assertImageKey rejects ${JSON.stringify(bad)}`, () => assertImageKey(bad));
  }

  // What the public route actually receives: the segments under /img/, with the
  // mount point already consumed by the route path. Each entry below is the
  // tail of a request to /img/… that must not resolve to anything.
  const uuid = '00000000-0000-0000-0000-000000000000';
  for (const segments of [
    ['logos', '..', 'blog', `${uuid}.webp`],
    ['..', '..', 'etc', 'passwd'],
    ['', 'etc', 'passwd'],
    ['logos', 'logo.webp'],
    ['cv', '1', `${uuid}.pdf`],
    ['logos', `${uuid}.svg`],
    ['logos', `${uuid}.webp.html`],
    ['LOGOS', `${uuid.toUpperCase()}.WEBP`],
    // Sending the prefix twice: the route puts `img/` back itself, so a request
    // to /img/img/logos/… must not become a valid key either.
    ['img', 'logos', `${uuid}.webp`],
    [`${uuid}.webp`],
  ]) {
    check(
      `/img/${segments.join('/')} does not resolve to a key`,
      imageKeyFromSegments(segments) === null,
    );
  }
  check(
    'the segments of a minted key round-trip back to it',
    imageKeyFromSegments(key.split('/').slice(1)) === key,
  );
  check('imageKeyFromSegments rejects an empty path', imageKeyFromSegments([]) === null);

  console.log('\n4. Conversion: we store what we produced, never what was uploaded');
  const fromPng = await processImage('logos', PNG);
  check('a PNG converts', fromPng.ok);
  check(
    'the output is WebP whatever went in',
    fromPng.ok && detectImageFileType(fromPng.bytes)?.format === 'webp',
  );
  const fromWebp = await processImage('logos', WEBP);
  check('a WebP is re-encoded rather than passed through', fromWebp.ok);
  check(
    're-encoding produced different bytes than the upload',
    fromWebp.ok && !Buffer.from(fromWebp.bytes).equals(Buffer.from(WEBP)),
  );

  // A polyglot: valid PNG bytes with an HTML payload appended. Browsers sniff,
  // scanners disagree, and the only durable answer is to not keep the bytes.
  const polyglot = new Uint8Array(PNG.byteLength + HTML.byteLength);
  polyglot.set(PNG);
  polyglot.set(HTML, PNG.byteLength);
  const fromPolyglot = await processImage('blog', polyglot);
  check('a PNG with an HTML tail still converts', fromPolyglot.ok);
  check(
    'the appended script does not survive re-encoding',
    fromPolyglot.ok &&
      Buffer.from(fromPolyglot.bytes).indexOf(Buffer.from('<script>', 'ascii')) === -1,
  );

  const wide = new Uint8Array(
    await sharp({
      create: { width: 2400, height: 1000, channels: 3, background: { r: 10, g: 10, b: 10 } },
    })
      .png()
      .toBuffer(),
  );
  const resized = await processImage('blog', wide);
  check(
    `a 2400px image is resized to the blog cap (${IMAGE_NAMESPACE_MAX_DIMENSION.blog})`,
    resized.ok && resized.width === IMAGE_NAMESPACE_MAX_DIMENSION.blog,
  );
  check(
    'the aspect ratio is preserved',
    resized.ok && Math.abs(resized.height - (1000 * IMAGE_NAMESPACE_MAX_DIMENSION.blog) / 2400) <= 1,
  );
  const asLogo = await processImage('logos', wide);
  check(
    `the same image is capped at ${IMAGE_NAMESPACE_MAX_DIMENSION.logos} in the logos namespace`,
    asLogo.ok && asLogo.width === IMAGE_NAMESPACE_MAX_DIMENSION.logos,
  );
  const small40 = await processImage('blog', PNG);
  check('an image under the cap is not upscaled', small40.ok && small40.width === 40);

  // EXIF is where a phone writes GPS. Publishing a photo must not publish where
  // it was taken.
  const withExif = new Uint8Array(
    await sharp({
      create: { width: 60, height: 60, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .withExif({ IFD0: { Copyright: 'trabajo', Software: 'SECRETLOCATION' } })
      .jpeg()
      .toBuffer(),
  );
  check(
    'the fixture really does carry EXIF',
    (await sharp(withExif).metadata()).exif !== undefined,
  );
  const stripped = await processImage('blog', withExif);
  check('the EXIF-bearing JPEG converts', stripped.ok);
  if (stripped.ok) {
    const meta = await sharp(stripped.bytes).metadata();
    check('EXIF does not survive conversion', meta.exif === undefined);
    check(
      'no EXIF string leaks into the stored bytes',
      Buffer.from(stripped.bytes).indexOf(Buffer.from('SECRETLOCATION', 'ascii')) === -1,
    );
  }

  // Decompression bomb: 43000 × 43000 is ~1.8 gigapixels, ~7 GB of RGBA, and
  // about 70 bytes on the wire.
  const bomb = pngHeaderOnly(43000, 43000);
  check('the bomb is tiny on the wire', bomb.byteLength < 100);
  const bombResult = await processImage('blog', bomb);
  check(
    'a 43000×43000 PNG header is refused',
    !bombResult.ok && (bombResult.reason === 'too_many_pixels' || bombResult.reason === 'decode_failed'),
  );
  check(
    'the pixel cap is well under what a bomb declares',
    MAX_IMAGE_INPUT_PIXELS < 43000 * 43000,
  );
  const justOver = await processImage('blog', pngHeaderOnly(20000, 20000));
  check(
    'a 400 MP header is refused too',
    !justOver.ok && (justOver.reason === 'too_many_pixels' || justOver.reason === 'decode_failed'),
  );

  const stillFrame = new Uint8Array(
    await sharp({
      create: { width: 20, height: 20, channels: 3, background: { r: 9, g: 9, b: 9 } },
    })
      .webp()
      .toBuffer(),
  );
  const animated = animatedWebp(stillFrame, 20, 60);
  check('the animated fixture passes magic-byte detection', detectImageFileType(animated)?.format === 'webp');
  check('60 frames cost the attacker a few kilobytes', animated.byteLength < 8 * 1024);
  const animatedResult = await processImage('blog', animated);
  check(
    'an animated WebP is refused rather than silently flattened',
    !animatedResult.ok && animatedResult.reason === 'animated',
  );

  const svgResult = await processImage('logos', SVG);
  check(
    'the SVG rejection is unsupported_type, not a decode failure',
    !svgResult.ok && svgResult.reason === 'unsupported_type',
  );
  const emptyResult = await processImage('logos', new Uint8Array());
  check('an empty upload is refused', !emptyResult.ok && emptyResult.reason === 'empty');
  const truncated = await processImage('logos', PNG.slice(0, 20));
  check('a truncated PNG is refused', !truncated.ok);

  console.log('\n5. Disk driver round trip');
  const dir = await mkdtemp(join(tmpdir(), 'trabajo-img-'));
  process.env.IMAGE_STORAGE_DIR = dir;
  const disk = createImageDiskDriver();

  const stored = fromPng.ok ? fromPng.bytes : new Uint8Array();
  await disk.put(key, stored);
  const stream = await disk.getStream(key);
  const readBack = new Uint8Array(await new Response(stream.body).arrayBuffer());
  check('what comes back out is what went in', Buffer.from(readBack).equals(Buffer.from(stored)));
  check('the driver reports the size', stream.size === stored.byteLength);
  check('the public URL is the key, site-relative', disk.publicUrl(key) === `/${key}`);
  check('the public URL is not absolute (no host to get wrong)', disk.publicUrl(key).startsWith('/'));

  await throws('putting the same key twice fails rather than overwriting', () =>
    disk.put(key, stored),
  );

  await disk.delete(key);
  await throws('reading a deleted object fails', () => disk.getStream(key));
  await disk.delete(key); // ENOENT is success: the bytes are gone either way.
  check('deleting an already-deleted object is not an error', true);

  await throws('the disk driver refuses a traversal key', () =>
    disk.getStream('img/logos/../../../etc/passwd'),
  );
  await throws('the disk driver refuses an absolute path', () => disk.getStream('/etc/passwd'));
  await writeFile(join(dir, 'secret.txt'), 'nope');
  await throws('a file planted in the root is unreachable', () => disk.getStream('secret.txt'));
  await throws('publicUrl refuses a malformed key', () => disk.publicUrl('img/logos/../x.webp'));

  process.env.IMAGE_STORAGE_DIR = 'relative/path';
  const relative = createImageDiskDriver();
  await throws('a relative IMAGE_STORAGE_DIR is refused', () => relative.getStream(key));
  process.env.IMAGE_STORAGE_DIR = dir;

  await rm(dir, { recursive: true, force: true });

  console.log('\n6. R2 driver');
  process.env.IMAGE_R2_ACCOUNT_ID = 'account';
  process.env.IMAGE_R2_BUCKET = 'trabajo-images';
  process.env.IMAGE_R2_ACCESS_KEY_ID = 'AKIAEXAMPLE';
  process.env.IMAGE_R2_SECRET_ACCESS_KEY = 'secretexample';
  process.env.IMAGE_R2_PUBLIC_BASE_URL = 'https://img.trabajo.com.py/';
  const r2 = createImageR2Driver();
  check(
    'the public URL is the configured domain plus the key',
    r2.publicUrl(key) === `https://img.trabajo.com.py/${key}`,
  );
  check('the trailing slash on the base URL is not doubled', !r2.publicUrl(key).includes('//img/'));
  check('the secret never appears in a public URL', !r2.publicUrl(key).includes('secretexample'));
  await throws('the R2 driver refuses a malformed key', () => r2.publicUrl('img/../x.webp'));
  await throws('the R2 driver refuses to delete a malformed key', () => r2.delete('img/../x.webp'));

  process.env.IMAGE_R2_PUBLIC_BASE_URL = 'http://img.trabajo.com.py';
  await throws('a non-https public base URL is refused', () => createImageR2Driver());
  delete process.env.IMAGE_R2_PUBLIC_BASE_URL;
  await throws('a missing public base URL fails at construction', () => createImageR2Driver());

  console.log(
    `\n${failures === 0 ? 'PASS' : 'FAIL'} — ${checks - failures}/${checks} checks passed.\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
