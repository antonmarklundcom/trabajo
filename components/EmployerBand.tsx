import Link from 'next/link';

/**
 * The other audience. Every public job and company page is also read by
 * people who hire; this is where the site's free listing is offered to them.
 * One component so the job page and the company page cannot drift apart.
 */
export default function EmployerBand({ className = 'mt-10' }: { className?: string }) {
  return (
    <section className={`${className} rounded-card bg-ink text-white p-6 sm:p-8`}>
      <h2 className="text-lg sm:text-xl font-bold">¿Tu empresa está contratando?</h2>
      <p className="mt-2 text-sm text-white/75 max-w-md">
        Publicá tu empleo gratis. Los postulantes te escriben directo a tu WhatsApp.
      </p>
      <Link
        href="/publicar"
        className="mt-5 inline-flex items-center justify-center min-h-11 px-5 rounded-[10px] bg-white text-ink font-semibold hover:bg-surface-2"
      >
        Publicar un empleo gratis
      </Link>
    </section>
  );
}
