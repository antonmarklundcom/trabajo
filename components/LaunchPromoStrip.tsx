// The launch-promotion banner shared by /planes and /publicar
// (PLAN-GROWTH.md §4 P2). Renders nothing once the promotion is off or the
// quota is spent — no PR is needed to end it, the copy just stops appearing.
import type { LaunchPromoStatus } from '@/lib/promo';

export default function LaunchPromoStrip({ promo }: { promo: LaunchPromoStatus }) {
  if (!promo.enabled || promo.remaining <= 0) return null;

  return (
    <div className="mb-8 rounded-[10px] border border-gold/40 bg-gold-tint px-5 py-4 text-center">
      <p className="text-sm font-semibold text-gold-strong">
        Promoción de lanzamiento · Los primeros 100 avisos aprobados salen destacados 90 días,
        gratis · Quedan {promo.remaining}
      </p>
    </div>
  );
}
