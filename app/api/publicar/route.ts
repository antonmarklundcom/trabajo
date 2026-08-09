import { z } from 'zod';
import { createPublicJobSubmission } from '@/lib/db/admin';

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
    console.error('[publicar] pending job creation failed —', err);
  }

  return Response.json({ ok: true }, { status: 201 });
}
