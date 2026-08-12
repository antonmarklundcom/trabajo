# PLAN-IMAGES.md — the shared public image pipeline

> **Written 2026-08-10 by Opus 5, alongside PR 18 (`lib/image-storage.ts`).**
> This document records the decisions PR 18 made so PR 19 (company logo
> upload) and PR 21 (job-posting images) can build on them without re-deriving
> or re-litigating any of it. Read `AGENTS.md` first; `PLAN-PHASE2.md` §3 is
> the CV equivalent of this document and the pattern being mirrored.
>
> **Corrected 2026-08-12.** As written, this document also listed **PR 20 (blog
> images)** as a third consumer. It is not one, and cannot be: the blog was
> decided as Väg A — committed Markdown, no table, no admin UI, no upload, no
> new auth surface (`PLAN-PHASE3-DRAFT.md` §5.1) — so there is no authorized
> upload route for this pipeline to sit behind. PR 20 has been redefined as
> **cover images committed to the repo**, which touches nothing in this file;
> the decision is `PLAN-PHASE3-DRAFT.md` §9 and its build brief is §10. The
> `blog` namespace stays in the code, reserved and unused, per §9.3 — every
> mention of it below is marked accordingly.
>
> **Superseded later the same day.** The owner triggered condition 1 of
> `PLAN-PHASE3-DRAFT.md` §5.1 and the blog was rebuilt as Väg B: article bodies
> in `blog_posts`, written from `/admin/blog`, with the cover image uploaded
> through `POST /api/admin/blog/[id]/portada` → `lib/blog-cover.ts` →
> `storeImage('blog', …)`. The reserved namespace has its caller. **This
> pipeline now has three consumers: PR 19 (logos), PR 21 (job images) and the
> blog covers** — nothing in the design below changed to accommodate the third,
> which is what §9.3 predicted when it declined to remove the reservation.

---

## 0. What PR 18 is, in one paragraph

One module — `lib/image-storage.ts` — accepts an uploaded image, decides
whether it is one, converts it to WebP, stores it under a minted key, and
returns a public URL for it. Two drivers sit behind that (`disk` and `r2`,
chosen by `IMAGE_STORAGE_DRIVER`), one public route serves the disk driver
(`app/img/[...key]/route.ts`), and `scripts/verify-image-storage.ts`
(`npm run image-storage:verify`) asserts the security properties by running
them. PR 18 ships **no UI**: no logo form, no job images. Those are PR 19 and
PR 21 (both built and merged, #42 and #43), and they are the only reason this
exists.

## 1. The threat model is inverted from CVs, and that is the whole design

`lib/storage.ts` protects private bytes from being read. This module protects
the public from the bytes. The failure mode is not a leak — it is **hosting an
attacker's file under our own domain**, which puts their content on our origin,
next to our cookies:

| Attack | What stops it |
|---|---|
| Stored XSS via a "PNG" that is really HTML or SVG | Magic-byte detection (JPEG/PNG/WebP only), then **re-encoding**: we store bytes we produced, never bytes we received |
| Polyglot file — valid PNG *and* valid HTML | Same. The re-encoder reads pixels and writes a new container; the appended payload does not survive |
| Decompression bomb (43000×43000 PNG, ~70 bytes on the wire) | `MAX_IMAGE_INPUT_PIXELS` (40 MP) checked from the header before decode, and passed to libvips as `limitInputPixels` |
| Frame-count bomb (a 60-frame animation, kilobytes on the wire) | Animations are refused outright — `metadata().pages > 1` |
| Path traversal into another key, or out of the storage root | `IMAGE_STORAGE_KEY_PATTERN` asserted on every driver method, plus a resolved-path-under-root check on disk |
| Disk/bucket fill | 4 MB streamed cap per upload, plus per-feature limits that belong to PR 19 and PR 21 (how many images a job may have is theirs to enforce) |
| EXIF leaking the photographer's GPS coordinates | Re-encoding strips EXIF/XMP/ICC — sharp keeps metadata only when asked to |

The verify script has a section per row.

## 2. Decision: `disk` is the default; `r2` is supported and is the growth path

**`IMAGE_STORAGE_DRIVER=disk` is what production runs at launch.** There is no
default value — an unset or misspelled driver throws on the first call, same as
`CV_STORAGE_DRIVER` — but when the owner asks "which one", the answer is disk,
and this section is why.

`PLAN-PHASE2.md` §3.1 recommends R2 **for CVs**. That recommendation does not
transfer, because the two things it rested on do not apply here:

1. **Durability of irreplaceable data.** A lost CV is a candidate's document we
   cannot reproduce and, under Ley N° 7593/2025, arguably a data-integrity
   failure. A lost logo is an employer re-uploading their logo. The whole weight
   behind "not a directory nobody backs up" is absent. (This argument originally
   also covered blog images "living next to Markdown the owner authored". That
   turned out to be the tell: content that lives next to committed Markdown does
   not belong in an upload store at all — see `PLAN-PHASE3-DRAFT.md` §9.2, where
   it is committed to git instead, versioned and deployed with the article.)
2. **Privacy of the store.** R2 for CVs means a *private* bucket with presigned
   reads. Images need the opposite — a public-read bucket — so this is a
   different bucket with a different ACL either way. Picking R2 here would not
   consolidate anything.

And one requirement pushes the other direction: images need a **public URL**.
On R2 that means either the `r2.dev` development domain, which Cloudflare
documents as rate-limited and not for production, or a **custom domain on
Cloudflare DNS** — a real infrastructure dependency (`trabajo.com.py`'s DNS is
not necessarily there) for a feature whose entire content is a few hundred
logos. Disk needs no new service, no new vendor and no DNS change.

**The disk driver's known trap is the same one CVs have, and it is handled the
same way.** `IMAGE_STORAGE_DIR` must be an absolute path **outside the build
root**: Hostinger replaces `public_html/.builds/last-source/` on every deploy
(`DEPLOY.md`), so a `public/` folder or any directory inside the app is deleted
by the next merge to `main` — with every uploaded image in it. This is also why
the disk driver is served by a **route handler** (`app/img/[...key]/route.ts`)
rather than static files: there is no static directory that survives.

### 2.1 Switching to R2 later costs an env var and a file copy

This is the part PR 19 and PR 21 must not work around. **The database stores the KEY,
never the URL** (`img/logos/{uuid}.webp`), and the URL is computed at render
time by `imagePublicUrl()`. So the migration, if image volume or an infra move
ever justifies it, is:

1. Create a public-read R2 bucket, copy `IMAGE_STORAGE_DIR` into it preserving
   the `img/...` paths as object keys.
2. Set `IMAGE_STORAGE_DRIVER=r2` plus `IMAGE_R2_*`, including
   `IMAGE_R2_PUBLIC_BASE_URL` (the bucket's custom domain).
3. Redeploy.

No DB migration, no row rewrite, no 301s. If any feature stores a rendered URL
in a column, that property is gone and the switch becomes a data migration —
which is the reason the rule is stated this bluntly.

The one thing that is *not* reversible for free is **changing the bucket or
directory under live data**: existing keys point into whatever store was live
when they were written, exactly as `candidate_cvs.storage_key` does.

### 2.2 Caching

Keys are minted per upload and never reused — replacing a logo mints a new key
and deletes the old object — so the bytes behind a URL can never change. The
route therefore serves `Cache-Control: public, max-age=31536000, immutable`,
which is what keeps serving images from a Node process on shared hosting a
non-issue: the second request for a given image does not reach us.

## 3. Validation rules, and why each number is that number

| Rule | Value | Reasoning |
|---|---|---|
| Accepted input | JPEG, PNG, WebP | By magic bytes only. The declared `Content-Type` and the filename are never consulted, anywhere |
| **SVG** | Rejected | An SVG is an XML document that can carry `<script>`. Serving one from our origin is stored XSS by construction. It fails by not matching a signature, and it is called out in code because "images" is the category a reviewer assumes includes it |
| **GIF** | Rejected (judgement, not necessity) | Accepting it means either flattening animations — the user uploads a moving image and silently gets a still one — or converting frame by frame, which makes frame *count* a second bomb dimension that the pixel cap does not bound. Nothing in PR 19 or PR 21 needs animation; a static GIF is a worse JPEG. Revisiting it means bounding `pages × width × height`, not adding four bytes to `detectImageFileType` |
| Upload size | **4 MB** | Under the CV limit, and set against what a phone actually produces: a 12 MP JPEG off an Android camera is 2–4 MB, and rejecting an employer's own photo of their storefront is a support ticket, not a security win. Bytes are not the DoS gate anyway — pixels are, because compression ratio is the attacker's free variable || Input pixels | **40 MP** | Header-checked before decode *and* enforced inside libvips. Above any real camera (a 100 MP phone sensor bins well below it), far below where decoding costs the process anything |
| Frames | 1 | See GIF above |
| Output | WebP, quality 82 | One output format, so the served `Content-Type` is a constant rather than something read back from storage. 82 is where WebP stops being visibly lossy on photographs |
| Output cap | logos **512 px**, jobs **1600 px** (`blog` **1600 px**, reserved and unreached) | Fit "inside", no enlargement. Logos render at a few hundred CSS pixels, so 512 is already 2× for retina; job images are content-width photographs. The `blog` entry exists because the namespace does (§4) and is never looked up — blog cover images are committed files, and the 1600 px figure lives on as the CI-asserted width in `PLAN-PHASE3-DRAFT.md` §10.5 |
| Metadata | Stripped | A consequence of re-encoding, and a deliberate one: EXIF is where a phone writes GPS. `.rotate()` runs first so the orientation tag is applied before it is dropped |

## 4. Key scheme

```
img/{namespace}/{uuid}.webp        namespace ∈ logos | blog | jobs
```

Asserted by `IMAGE_STORAGE_KEY_PATTERN` on **every** driver method, including
`publicUrl()`. The namespace is a literal from a union that a caller names for
the surface it owns — it is never read from a request — and the rest is a v4
UUID. Nothing about a key is derived from user input, not the filename and not
an id, which is what makes the assertion a tautology rather than a check that
could one day fail open.

`blog` is **reserved and has no caller** (`PLAN-PHASE3-DRAFT.md` §9.3): blog
cover images are committed to git, not uploaded. It is kept rather than removed
because deleting it means editing a security-critical union, its key regex and
`verify-image-storage.ts` for no functional gain, and putting all three back the
day Väg B moves article bodies into the database — where an upload surface, and
therefore this pipeline, is the right answer. An uninhabited branch of a closed
union weakens nothing: `buildImageKey()` is never called with it.

The public route reconstructs the key from catch-all path segments through
`imageKeyFromSegments()`, which returns `null` for anything that is not exactly
a minted key. It does no unescaping, no normalising and no `..` stripping: a
segment that needed cleaning up is not a key we minted, so it is not a key, and
the route answers 404.

## 5. What PR 19 and 21 inherit

The whole surface they should need:

```ts
storeImage(namespace, bytes)   // validate → WebP → store; returns { key, width, height }
deleteImage(key)               // object first, row second — see below
imagePublicUrl(key)            // where the browser fetches it
readLimitedImageBody(request)  // 4 MB enforced on the stream
IMAGE_REJECTION_MESSAGES       // the Spanish copy for each rejection reason
```

Rules that come with them:

- **Store the key in the database, never the URL** (§2.1).
- **Delete the object before clearing the row that points at it**, and let the
  error propagate — the same asymmetry as CVs. A row pointing at bytes that are
  gone renders one broken image; an object with no row pointing at it is a file
  nobody can ever remove. Replacing a logo is validate, store, then delete the
  old object — a store that succeeds and a delete that fails leaves one
  orphan, which is the acceptable failure mode; the reverse order destroyed
  live data on any rejected upload.
- **Authorization is the caller's job and is checked server-side**, per
  `AGENTS.md`. This module will happily store bytes for anyone who calls it; it
  is the route handler that decides whether this employer may touch this
  company's logo. `companyId` scoping for employer writes goes through
  `lib/db/employer.ts` as usual.
- **Per-feature counts and limits belong to the caller.** "1–3 images per job
  posting" (PR 21) is PR 21's rule, enforced where the row is written. This
  module bounds a single upload, not how many a user may make.
- **Nothing private goes in this store, ever.** It is public by construction —
  the route has no session check, because an image on an approved posting is
  public content. CVs have their own module and their own three authorized
  routes, and the two stores must not be merged "since both are just files".

## 6. Deliberately not built

- **No image variants / responsive srcset.** One stored size per namespace. If
  a layout later needs multiple widths, that is a second stored key per image,
  not on-the-fly resizing in a route handler — resizing on request makes the
  URL a resize parameter, and a resize parameter is a CPU-exhaustion endpoint.
- **No `next/image` loader integration.** Nothing here forbids it later; it
  simply is not needed to render a `<img src={imagePublicUrl(key)}>`.
- **No upload UI, no drag-and-drop component, no cropper.** PR 19 owns the
  first one and the others can copy it.
- **No orphan sweeper.** Every consumer deletes its own object when it clears
  the row. If a third consumer appears and forgets, the fix is that consumer,
  not a background job that decides which objects nobody wants.

## 7. Not everything with a picture in it belongs here

Added 2026-08-12, because the PR 20 contradiction (see the note at the top) is
the kind that recurs. This pipeline exists for **bytes an outside party hands
us at runtime** — an employer uploading a logo, an employer uploading a photo of
the workplace. Its entire design, from magic-byte detection to re-encoding to
minted keys, is an answer to "someone we do not control is putting a file on our
origin".

Images that are **committed to this repo** are not that, and must not be routed
through it:

- `public/logos/*.svg` (the category icons) are authored in a pull request by
  whoever can already deploy arbitrary code. There is no attacker to stop and no
  validation that would add a guarantee the commit does not already give.
  (`public/blog-covers/*.webp` was the other example here until 2026-08-12, when
  the blog moved to Väg B — `PLAN-PHASE3-DRAFT.md` §11. Blog covers are now
  uploaded at runtime from `/admin/blog` and therefore go through this pipeline
  after all, which is the test below working rather than an exception to it:
  what changed was *when the bytes are produced*, and the answer changed the
  storage. The directory was never created.)
- They are also better off in git: versioned, reviewed, deployed with the code,
  and immune to the `IMAGE_STORAGE_DIR`-outside-the-build-root trap in §2, which
  only exists because uploaded files have to survive a deploy on their own.

The test for a new feature is not "does it show an image" but **"who produces
the bytes, and when"**. Runtime, from someone with an account → this pipeline,
with an authorized route in front of it. Build time, from a commit → a file in
`public/`, with the size and format rules asserted in CI instead. Nothing may be
written into `public/` at runtime, and nothing private goes in either store.
