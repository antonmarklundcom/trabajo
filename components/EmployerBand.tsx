import Link from 'next/link';
import { getPlanPricing } from '@/lib/pricing';
import { activePromo, formatPromoEnd } from '@/lib/plans';

/**
 * The other audience. Every public job and company page is also read by
 * people who hire; this is where publishing is offered to them.
 * One component so the job page and the company page cannot drift apart.
 */
export default async function EmployerBand({ className = 'mt-10' }: { className?: string }) {
  // "Gratis" only while the Básico promotion really is free (lib/plans.ts).
  const promo = activePromo((await getPlanPricing()).basico);
  const free = promo?.priceGs === 0;
  return (
    <section className={`${className} rounded-card bg-ink text-white p-6 sm:p-8`}>
      <h2 className="text-lg sm:text-xl font-bold">¿Tu empresa está contratando?</h2>
      <p className="mt-2 text-sm text-white/75 max-w-md">
        {free
          ? `Publicá tu empleo gratis hasta el ${formatPromoEnd(promo.endsAt)}. Los postulantes te escriben directo a tu WhatsApp.`
          : 'Publicá tu empleo. Los postulantes te escriben directo a tu WhatsApp.'}
      </p>
      <Link
        href="/publicar"
        className="mt-5 inline-flex items-center justify-center min-h-11 px-5 rounded-[10px] bg-white text-ink font-semibold hover:bg-surface-2"
      >
        {free ? 'Publicar un empleo gratis' : 'Publicar un empleo'}
      </Link>
    </section>
  );
}
