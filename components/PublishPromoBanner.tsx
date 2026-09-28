// "Publicar es gratis hasta el 31 de octubre" — the time-limited Básico offer
// (lib/plans.ts), shared by /planes and /publicar so the deadline and the
// after-price are stated identically wherever an employer decides.
//
// Every number in it is real: the date is the one saved in /admin/precios, the
// day count is computed from it, and the offer ends by itself when the date
// passes (activePromo() returns null and this renders nothing). Urgency that
// is true is persuasive; a countdown that resets is misleading advertising.
import {
  activePromo,
  formatGs,
  formatPromoEnd,
  promoDaysLeft,
  type PlanPricingTable,
} from '@/lib/plans';

export default function PublishPromoBanner({
  pricing,
  className = 'mb-8',
}: {
  pricing: PlanPricingTable;
  className?: string;
}) {
  const basico = pricing.basico;
  const promo = activePromo(basico);
  if (!promo) return null;

  const days = promoDaysLeft(promo.endsAt);
  const until = formatPromoEnd(promo.endsAt);
  const headline =
    promo.priceGs === 0
      ? `Publicar tu aviso es gratis hasta el ${until}`
      : `Publicá tu aviso a ${formatGs(promo.priceGs)} hasta el ${until}`;

  return (
    <div className={`${className} rounded-[10px] border-2 border-brand/40 bg-brand-tint px-5 py-4 text-center`}>
      <p className="text-xs font-bold uppercase tracking-wider text-brand">
        Promoción por tiempo limitado · {days === 1 ? 'Último día' : `Quedan ${days} días`}
      </p>
      <p className="mt-1 text-lg font-bold text-ink">{headline}</p>
      <p className="mt-1 text-sm text-ink-secondary">
        Después cuesta {formatGs(basico.priceGs)} por aviso. Los avisos enviados antes de esa fecha
        se publican con la promoción por sus 30 días completos.
      </p>
    </div>
  );
}
