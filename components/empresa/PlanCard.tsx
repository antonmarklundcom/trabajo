// The plan / featured card on /empresa (PLAN-NEXT.md §3 P1).
//
// Read-only by design. `featured_until` is set by the admin after a manual
// sale; there is no self-serve purchase, and adding a button that looked like
// one would be a promise the site cannot keep. The action offered is the one
// that actually works: a WhatsApp message to the team.
import Link from 'next/link';

type Props = {
  activeFeaturedCount: number;
  featuredUntil: Date | null;
  lastFeaturedUntil: Date | null;
  companyName: string;
};

function formatDate(date: Date): string {
  return date.toLocaleDateString('es-PY', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function PlanCard({
  activeFeaturedCount,
  featuredUntil,
  lastFeaturedUntil,
  companyName,
}: Props) {
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_LEADS ?? '';
  const isFeatured = featuredUntil !== null;

  const renewHref = whatsapp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(
        `Hola, soy de ${companyName} y quiero renovar el plan Destacado.`,
      )}`
    : null;

  return (
    <div
      className={`rounded-[10px] border p-5 ${
        isFeatured ? 'border-[#C0362A]/30 bg-[#FBECE9]' : 'border-[#E7E1D6] bg-white'
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-[#57514A]">Plan actual</p>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            isFeatured ? 'bg-[#C0362A] text-white' : 'bg-[#F5F1EA] text-[#57514A]'
          }`}
        >
          {isFeatured ? 'Destacado' : 'Básico'}
        </span>
      </div>

      {isFeatured ? (
        <>
          <p className="text-base font-semibold text-[#1E1B17] mt-2">
            Destacado activo hasta {formatDate(featuredUntil)}
          </p>
          <p className="text-sm text-[#57514A] mt-1">
            {activeFeaturedCount === 1
              ? '1 empleo aparece primero en los resultados.'
              : `${activeFeaturedCount} empleos aparecen primero en los resultados.`}
          </p>
          {renewHref && (
            <a
              href={renewHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-sm font-semibold text-[#C0362A] hover:underline"
            >
              Renovar por WhatsApp →
            </a>
          )}
        </>
      ) : (
        <>
          <p className="text-base font-semibold text-[#1E1B17] mt-2">
            Tus empleos se publican gratis
          </p>
          <p className="text-sm text-[#57514A] mt-1">
            {lastFeaturedUntil
              ? // Named rather than glossed as "expired": an employer who paid
                // once should be able to see when, without opening a chat.
                `Tu último Destacado venció el ${formatDate(lastFeaturedUntil)}. Con Destacado tus empleos aparecen primero.`
              : 'Con el plan Destacado tus empleos aparecen primero en los resultados.'}{' '}
            <Link href="/planes" className="font-semibold text-[#C0362A] hover:underline">
              Ver planes
            </Link>
          </p>
          {lastFeaturedUntil && renewHref && (
            <a
              href={renewHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-sm font-semibold text-[#C0362A] hover:underline"
            >
              Renovar por WhatsApp →
            </a>
          )}
        </>
      )}
    </div>
  );
}
