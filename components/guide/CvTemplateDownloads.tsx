// Download cards for the CV templates committed under public/descargas/.
// Those files are static assets built once (not uploads, nothing written at
// runtime); the generators live in scripts/cv-templates/.

export type CvTemplate = {
  id: string;
  title: string;
  description: string;
  docx: string;
  pdf: string;
  pdfLabel: string;
};

export const CV_TEMPLATES: CvTemplate[] = [
  {
    id: 'basico',
    title: 'CV básico (cronológico)',
    description: 'El formato más usado en Paraguay: perfil, experiencia de la más reciente a la más antigua, formación, idiomas y referencias. Con espacio para foto.',
    docx: '/descargas/plantilla-curriculum-vitae-basico.docx',
    pdf: '/descargas/plantilla-curriculum-vitae-basico.pdf',
    pdfLabel: 'PDF de muestra',
  },
  {
    id: 'sin-experiencia',
    title: 'CV sin experiencia (primer empleo)',
    description: 'Pone primero la formación y la experiencia práctica: changas, negocio familiar, voluntariado. Viene completo con un ejemplo para reemplazar.',
    docx: '/descargas/plantilla-cv-sin-experiencia.docx',
    pdf: '/descargas/plantilla-cv-sin-experiencia.pdf',
    pdfLabel: 'PDF de ejemplo',
  },
  {
    id: 'para-llenar',
    title: 'Curriculum vitae para llenar',
    description: 'Formulario con líneas para imprimir y completar a mano, o para llenar en Word. Útil para dejar tu carpeta en persona.',
    docx: '/descargas/curriculum-vitae-para-llenar.docx',
    pdf: '/descargas/curriculum-vitae-para-llenar.pdf',
    pdfLabel: 'PDF para imprimir',
  },
];

export default function CvTemplateDownloads({ only }: { only?: string[] }) {
  const templates = only ? CV_TEMPLATES.filter((t) => only.includes(t.id)) : CV_TEMPLATES;
  return (
    <ul className="not-prose grid grid-cols-1 gap-3">
      {templates.map((t) => (
        <li key={t.id} className="rounded-card border border-border bg-surface p-5 shadow-card">
          <p className="font-bold text-ink">{t.title}</p>
          <p className="mt-1 text-sm text-ink-secondary">{t.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={t.docx}
              download
              className="inline-flex items-center min-h-11 px-4 rounded-[10px] bg-ink text-white text-sm font-semibold hover:bg-ink/90"
            >
              Descargar Word (.docx)
            </a>
            <a
              href={t.pdf}
              download
              className="inline-flex items-center min-h-11 px-4 rounded-[10px] border border-border-strong text-ink text-sm font-semibold hover:border-brand hover:text-brand"
            >
              {t.pdfLabel}
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}
