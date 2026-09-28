import { z } from 'zod';
import { authErrorResponse, requireApiSession, requireRole } from '@/lib/auth';
import { invalidatePricing } from '@/lib/cache';
import { savePlanPrices } from '@/lib/db/plan-prices';
import {
  PLAN_KEYS,
  promoEndFromDateInput,
  validatePlanPricing,
  type PlanPricing,
} from '@/lib/plans';

// The one write behind /admin/precios. Admin only — a price is an owner
// decision, not curation, so editors (who can approve jobs) cannot change it.
// Checked here because the page hiding the nav item is UX, not security
// (AGENTS.md).
//
// Nothing here touches a job. A price, or a promotion that makes a package
// free, never publishes or approves anything: every listing still lands
// `pending` and reaches the site only through /admin approval.
const planSchema = z.object({
  key: z.enum(PLAN_KEYS),
  priceGs: z.number().int(),
  promo: z.object({ priceGs: z.number().int(), endsOn: z.string() }).nullable(),
});

const schema = z.object({ plans: z.array(planSchema).length(PLAN_KEYS.length) });

export async function PUT(request: Request) {
  try {
    const user = await requireApiSession();
    requireRole(user, ['admin']);

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: 'Datos inválidos.' }, { status: 400 });
    }
    const { plans } = parsed.data;
    if (new Set(plans.map((plan) => plan.key)).size !== PLAN_KEYS.length) {
      return Response.json({ error: 'Faltan paquetes.' }, { status: 400 });
    }

    const errors = plans.flatMap((plan) => validatePlanPricing(plan));
    if (errors.length) {
      return Response.json({ error: errors.join(' ') }, { status: 400 });
    }

    const rows: PlanPricing[] = plans.map((plan) => ({
      key: plan.key,
      priceGs: plan.priceGs,
      promoPriceGs: plan.promo?.priceGs ?? null,
      promoEndsAt: plan.promo ? promoEndFromDateInput(plan.promo.endsOn) : null,
    }));
    await savePlanPrices(user.id, rows);
    invalidatePricing();
    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
