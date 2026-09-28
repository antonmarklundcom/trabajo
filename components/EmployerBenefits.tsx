// Why publish here rather than post in a social-media job group — the value
// case, shared by /publicar-gratis and /planes so both pages make the same
// claims.
//
// Every line describes what the product DOES, never how many candidates or how
// fast (PLAN-GROWTH.md §7 D1): no applicant counts, no "más postulantes", no
// reach numbers. The comparison names no competitor; it contrasts a listing
// with "a post in a feed", which is what employers already know.

const BENEFITS: { title: string; body: string; icon: string }[] = [
  {
    icon: 'M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z',
    title: 'Activo 30 días, no un posteo que se pierde',
    body: 'Tu aviso queda publicado un mes entero. No se hunde en un feed entre decenas de posteos del día.',
  },
  {
    icon: 'M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z',
    title: 'Los postulantes te encuentran',
    body: 'Buscan y filtran por categoría, ciudad y salario, y llegan directo a tu puesto. Tu aviso está ordenado, no mezclado con todo lo demás.',
  },
  {
    icon: 'M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z',
    title: 'Una página propia, preparada para Google',
    body: 'Cada aviso tiene su propia dirección, con los datos que Google usa para mostrar ofertas de empleo en sus búsquedas.',
  },
  {
    icon: 'M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7z',
    title: 'Postulaciones directo a tu WhatsApp',
    body: 'Los candidatos te escriben a tu número o se postulan con el formulario del aviso. Sin intermediarios.',
  },
  {
    icon: 'M9 2a1 1 0 000 2h2a1 1 0 100-2H9zM4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z',
    title: 'Sin diseñar flyers',
    body: 'Completás un formulario simple con el puesto, la ciudad y la descripción. Tu aviso se ve prolijo y fácil de leer en el celular.',
  },
  {
    icon: 'M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z',
    title: 'Un portal serio, sin spam',
    body: 'Revisamos cada aviso antes de publicarlo. Tu empresa no aparece entre estafas ni entre los mismos posteos repetidos todos los días.',
  },
];

export function EmployerBenefits({ className = '' }: { className?: string }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
      {BENEFITS.map((b) => (
        <div key={b.title} className="bg-white rounded-[10px] border border-border p-5">
          <div className="w-10 h-10 rounded-[10px] bg-brand-tint text-brand flex items-center justify-center mb-3">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" clipRule="evenodd" d={b.icon} />
            </svg>
          </div>
          <h3 className="font-semibold text-ink">{b.title}</h3>
          <p className="mt-1 text-sm text-ink-secondary leading-relaxed">{b.body}</p>
        </div>
      ))}
    </div>
  );
}

const COMPARISON: { label: string; post: string; listing: string }[] = [
  { label: 'Cuánto dura', post: 'Horas, hasta que lo tapan los posteos nuevos', listing: '30 días publicado' },
  { label: 'Cómo lo encuentran', post: 'Scrolleando un feed', listing: 'Buscando y filtrando por categoría, ciudad y salario' },
  { label: 'En Google', post: 'Rara vez', listing: 'Página propia con los datos de la oferta' },
  { label: 'Quién publica al lado', post: 'Cualquiera, todos los días', listing: 'Avisos revisados por el equipo' },
  { label: 'Cómo se postulan', post: 'Comentarios y mensajes sueltos', listing: 'Tu WhatsApp o el formulario del aviso' },
];

export function PostVsListing({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-[10px] border border-border overflow-hidden ${className}`}>
      <div className="grid grid-cols-[1fr_1fr] sm:grid-cols-[10rem_1fr_1fr] text-sm">
        <div className="hidden sm:block px-4 py-3 bg-surface-2" />
        <div className="px-4 py-3 bg-surface-2 font-semibold text-ink-secondary">Un posteo en redes</div>
        <div className="px-4 py-3 bg-brand-tint font-semibold text-brand">Un aviso en trabajo.com.py</div>
        {COMPARISON.map((row) => (
          <div key={row.label} className="contents">
            <div className="col-span-2 sm:col-span-1 px-4 pt-3 sm:py-3 border-t border-border text-xs sm:text-sm font-semibold text-ink">
              {row.label}
            </div>
            <div className="px-4 pb-3 sm:py-3 sm:border-t border-border text-ink-secondary">{row.post}</div>
            <div className="px-4 pb-3 sm:py-3 sm:border-t border-border text-ink font-medium">{row.listing}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
