// POST /api/postulante/cv — upload (or replace) the logged-in candidate's CV.
//
// The enforcement point for PLAN-PHASE2.md §3.2: 5 MB checked while the body
// streams, magic bytes rather than Content-Type or extension, a minted storage
// key, and the object written before the row that records it.
//
// The body is the raw file, not multipart/form-data. Next 16 route handlers
// receive a Web Request (node_modules/next/dist/docs/01-app/03-api-reference/
// 03-file-conventions/route.md), and `request.formData()` buffers everything
// before it yields the first field — which would make a size limit a thing we
// measure after the damage. The filename travels in a header instead; it is
// untrusted either way and is sanitised before it is stored.
import { requireApiCandidate } from '@/lib/auth-candidate';
import { authErrorResponse } from '@/lib/auth';
import { candidateAccountsEnabled } from '@/lib/flags';
import {
  ACCEPTED_CV_EXTENSIONS,
  buildStorageKey,
  detectCvFileType,
  MAX_CV_BYTES,
  readLimitedBody,
  sanitizeOriginalFilename,
} from '@/lib/cv';
import { createCandidateCv } from '@/lib/db/candidate-cvs';
import { getStorage } from '@/lib/storage';
import { captureError } from '@/lib/observability';

const NOT_FOUND = () => Response.json({ error: 'No encontrado.' }, { status: 404 });

/** Headers are latin1 on the wire, so the client sends encodeURIComponent(name). */
function filenameFromHeader(request: Request): string | null {
  const raw = request.headers.get('x-cv-filename');
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function POST(request: Request) {
  // The /postulante layout's notFound() only guards page routes; a route
  // handler outside that tree has to repeat the flag check or a dark feature
  // would still accept uploads.
  if (!candidateAccountsEnabled()) return NOT_FOUND();

  try {
    const candidate = await requireApiCandidate();

    const body = await readLimitedBody(request);
    if (!body.ok) {
      return body.reason === 'too_large'
        ? Response.json(
            { error: `El archivo supera el límite de ${MAX_CV_BYTES / (1024 * 1024)} MB.` },
            { status: 413 },
          )
        : Response.json({ error: 'No se recibió ningún archivo.' }, { status: 400 });
    }

    const fileType = detectCvFileType(body.bytes);
    if (!fileType) {
      return Response.json(
        {
          error: `Formato no admitido. Subí tu CV en ${ACCEPTED_CV_EXTENSIONS.join(', ')}.`,
        },
        { status: 415 },
      );
    }

    const storageKey = buildStorageKey(candidate.id, fileType.extension);
    const originalFilename = sanitizeOriginalFilename(
      filenameFromHeader(request),
      fileType.extension,
    );

    // Bytes first. If this throws, no row is written and the candidate sees an
    // error — the opposite order would leave a row pointing at nothing.
    await getStorage().put(storageKey, body.bytes, fileType.mimeType);

    const id = await createCandidateCv(candidate.id, {
      storageKey,
      originalFilename,
      mimeType: fileType.mimeType,
      sizeBytes: body.bytes.byteLength,
    });

    return Response.json(
      {
        id,
        originalFilename,
        mimeType: fileType.mimeType,
        sizeBytes: body.bytes.byteLength,
      },
      { status: 201 },
    );
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    captureError('cv:candidate-upload', err);
    return Response.json({ error: 'No pudimos guardar tu CV. Intentá de nuevo.' }, { status: 500 });
  }
}
