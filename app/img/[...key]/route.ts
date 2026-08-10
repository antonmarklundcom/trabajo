// GET /img/{namespace}/{uuid}.webp — the public read path for stored images.
//
// This route exists because Hostinger replaces `public_html/.builds/last-source/`
// on every deploy (DEPLOY.md), so a `public/` folder cannot hold uploads: the
// next merge to main deletes them. IMAGE_STORAGE_DIR lives outside the build
// root and this handler is what makes it reachable — PLAN-IMAGES.md §2.
//
// It is public on purpose and has no session check: an image referenced from an
// approved job posting or a published article is public content. There is
// nothing to authorize, which is precisely why nothing private may ever be
// stored under this driver (CVs have their own module and their own three
// authorized routes).
//
// The URL path IS the storage key: /img/logos/{uuid}.webp serves
// img/logos/{uuid}.webp. imageKeyFromSegments() re-derives the key from the
// catch-all segments (which exclude this route's own `img` mount point, so it
// puts the prefix back) and returns null for anything that is not exactly a key
// we minted — traversal, absolute paths and probing for other files all land on
// the same 404.
//
// Under the R2 driver imagePublicUrl() points at the bucket's public domain and
// nothing hits this handler; it keeps working either way rather than 404ing on
// a config the deploy could still switch back.
import { getImageStorage, imageKeyFromSegments, IMAGE_OUTPUT_MIME_TYPE } from '@/lib/image-storage';

const NOT_FOUND = () => new Response('Not found', { status: 404 });

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = imageKeyFromSegments((await params).key ?? []);
  if (key === null) return NOT_FOUND();

  let stream;
  try {
    stream = await getImageStorage().getStream(key);
  } catch {
    // A missing object and a misconfigured driver are the same 404 to the
    // browser; the difference belongs in the logs, not in a probe response.
    return NOT_FOUND();
  }

  const headers = new Headers({
    // Not the stored object's declared type, and not sniffed: this pipeline
    // stores WebP and only WebP, so the type is a constant.
    'content-type': IMAGE_OUTPUT_MIME_TYPE,
    'x-content-type-options': 'nosniff',
    // Keys are minted per upload and never reused, so the bytes behind a URL
    // can never change. A replaced logo is a new key.
    'cache-control': 'public, max-age=31536000, immutable',
    // Defence in depth for the one thing that would matter if the WebP
    // invariant above were ever broken: navigating straight to this URL must
    // not be able to run anything.
    'content-security-policy': "default-src 'none'; sandbox",
  });
  if (stream.size !== null) headers.set('content-length', String(stream.size));

  return new Response(stream.body, { status: 200, headers });
}
