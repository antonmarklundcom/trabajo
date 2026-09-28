import type { Metadata } from 'next';
import { requireSessionWithRole } from '@/lib/auth';
import { getPlanPricing } from '@/lib/pricing';
import { PLAN_KEYS, dateInputFromPromoEnd } from '@/lib/plans';
import PricingForm, { type PricingFormPlan } from '@/components/admin/PricingForm';

export const metadata: Metadata = { title: 'Precios' };

// Admin only, like the handler it posts to (app/api/admin/precios/route.ts).
export default async function AdminPreciosPage() {
  await requireSessionWithRole(['admin']);
  const pricing = await getPlanPricing();
  const plans: PricingFormPlan[] = PLAN_KEYS.map((key) => {
    const plan = pricing[key];
    return {
      key,
      priceGs: plan.priceGs,
      promoPriceGs: plan.promoPriceGs,
      promoEndsOn: dateInputFromPromoEnd(plan.promoEndsAt),
    };
  });

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-ink">Precios y promociones</h1>
      <p className="text-sm text-ink-secondary mt-1 mb-6">
        Lo que ves acá es lo que muestran /planes, /publicar y la portada. Una promoción siempre
        tiene fecha de fin y termina sola ese día a las 23:59 (hora de Paraguay). Si una promoción
        ya venció, el formulario la muestra desmarcada.
      </p>
      <PricingForm plans={plans} />
    </div>
  );
}
