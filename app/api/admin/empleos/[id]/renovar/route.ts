// POST /api/admin/empleos/[id]/renovar — extend a published listing's public
// period (lib/listing-expiry.ts).
//
// Same shape as ../destacar: the body carries a NUMBER OF DAYS from a closed
// list, never a date, so the new expiry is computed from the server's clock in
// renewJobListing() and a client cannot send an end date at all.
import { z } from 'zod';

import { authErrorResponse, requireApiSession, requireRole } from '@/lib/auth';
import { renewJobListing } from '@/lib/db/admin';
import { isListingRenewalDays } from '@/lib/listing-expiry';
import { invalidatePublicContent } from '@/lib/cache';

const renewSchema = z.object({
  days: z.number().int().refine(isListingRenewalDays),
});

async function loadId(params: Promise<{ id: string }>) {
  const { id } = await params;
  const numId = Number(id);
  return Number.isInteger(numId) && numId > 0 ? numId : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiSession();
    requireRole(user, ['admin', 'editor']);

    const id = await loadId(params);
    if (id === null) return Response.json({ error: 'Empleo no encontrado.' }, { status: 404 });

    const body = await request.json().catch(() => null);
    const parsed = renewSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: 'Datos inválidos.' }, { status: 400 });

    const days = parsed.data.days;
    if (!isListingRenewalDays(days)) return Response.json({ error: 'Datos inválidos.' }, { status: 400 });

    const result = await renewJobListing(id, user.id, days);
    if (!result) {
      return Response.json(
        { error: 'Solo se puede renovar un empleo publicado.' },
        { status: 409 },
      );
    }

    // An expired listing comes back onto every public list, so this changes
    // what visitors see.
    invalidatePublicContent();

    return Response.json({ ok: true, expiresAt: result.expiresAt.toISOString() });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
