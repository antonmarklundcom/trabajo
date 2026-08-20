import { z } from 'zod';
import { createPublicJobSubmission } from '@/lib/db/admin';
import { clientIpOrUnknown } from '@/lib/client-ip';
import { HONEYPOT_FIELD, isHoneypotFilled } from '@/lib/leads';
import { isRateLimited } from '@/lib/public-write-limiter';
import { captureError } from '@/lib/observability';

// Public, unauthenticated by design — every row this creates lands as
// `status = 'pending'`, which lib/db/queries.ts's visiblePredicate() already
// excludes from every public read (ARCHITECTURE.md §4/§6).
const schema = z.object({
  companyName: z.string().min(2).max(150),
  contactWhatsapp: z.string().min(6).max(30),
  jobTitle: z.string().min(3).max(200),
  categorySlug: z.string().min(1),
  citySlug: z.string().min(1),
  description: z.string().min(20).max(3000),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  // Same bot guard as POST /api/v1/leads (lib/leads.ts, PLAN.md step 9) —
  // this is the second public write on the /publicar submission path.
  // Rejections are a SILENT 2xx, logged server-side only.
  const ip = clientIpOrUnknown(request.headers);
  if (isHoneypotFilled((body as Record<string, unknown> | null)?.[HONEYPOT_FIELD])) {
    console.warn('[publicar] honeypot triggered — rejecting silently', { ip });
    return Response.json({ ok: true }, { status: 201 });
  }
  if (isRateLimited(ip)) {
    console.warn('[publicar] rate limit exceeded — rejecting silently', { ip });
    return Response.json({ ok: true }, { status: 201 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Datos inválidos.' }, { status: 400 });
  }

  // The WhatsApp/webhook fan-out at POST /api/v1/leads is the primary channel
  // — the sales conversation starts there regardless of this insert. A DB
  // failure here must never surface to the employer as a failed submission.
  try {
    await createPublicJobSubmission(parsed.data);
  } catch (err) {
    captureError('publicar:pending-job-create', err);
  }

  return Response.json({ ok: true }, { status: 201 });
}
