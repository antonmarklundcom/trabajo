// POST/DELETE /api/admin/empleos/[id]/destacar — fulfil or reverse a manual
// Destacado sale (PLAN-NEXT.md §3 P1, PLAN-PAGOPAR.md §1).
//
// A separate handler from PATCH /api/admin/empleos/[id] on purpose. That one
// saves the whole listing and still carries the raw `featuredUntil` override
// (unchanged — it is the escape hatch for the odd case). This one does the
// ordinary thing, and it is deliberately narrower: it accepts a NUMBER OF DAYS,
// never a date, so the window is computed from the server's clock in
// grantJobFeature() and a client cannot send an end date at all.
import { z } from 'zod';

import { authErrorResponse, requireApiSession, requireRole } from '@/lib/auth';
import { grantJobFeature, revokeJobFeature } from '@/lib/db/admin';
import { FEATURE_PAYMENT_METHODS, isFeatureDuration } from '@/lib/featured';
import { invalidatePublicContent } from '@/lib/cache';

const grantSchema = z.object({
  // A closed list, not a range. The UI offers four buttons and nothing else
  // sells a Destacado, so an arbitrary number of days would be a shape only a
  // hand-written request could produce.
  days: z.number().int().refine(isFeatureDuration),
  extend: z.boolean(),
  // Guaraníes have no cents, and the cap is a typo guard rather than a policy:
  // a Destacado is a five- or six-figure sum in Gs., not a nine-figure one.
  amountGs: z.number().int().nonnegative().max(1_000_000_000).nullable(),
  method: z.enum(FEATURE_PAYMENT_METHODS).nullable(),
  note: z.string().max(500).nullable(),
});

const revokeSchema = z.object({ note: z.string().max(500).nullable() });

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
    const parsed = grantSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'Datos inválidos.' }, { status: 400 });
    }

    const result = await grantJobFeature(id, user.id, {
      days: parsed.data.days,
      extend: parsed.data.extend,
      amountGs: parsed.data.amountGs,
      method: parsed.data.method,
      note: parsed.data.note?.trim() || null,
    });
    if (!result) return Response.json({ error: 'Empleo no encontrado.' }, { status: 404 });

    // Featured jobs float to the top of every sort order except `salario`, so
    // this genuinely changes public output — unlike the employer job POST,
    // where the same call is belt-and-braces.
    invalidatePublicContent();

    return Response.json({ ok: true, featuredUntil: result.featuredUntil.toISOString() });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiSession();
    requireRole(user, ['admin', 'editor']);

    const id = await loadId(params);
    if (id === null) return Response.json({ error: 'Empleo no encontrado.' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const parsed = revokeSchema.safeParse(body ?? {});
    const note = parsed.success ? (parsed.data.note?.trim() || null) : null;

    const result = await revokeJobFeature(id, user.id, note);
    if (!result) return Response.json({ error: 'Empleo no encontrado.' }, { status: 404 });

    invalidatePublicContent();
    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
