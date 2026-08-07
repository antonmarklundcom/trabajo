const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-[#F5F1EA] text-[#57514A]',
  pending: 'bg-[#FAF1DC] text-[#8F6620]',
  published: 'bg-[#E8F3EC] text-[#2E7D50]',
  rejected: 'bg-[#FCEBEA] text-[#B42318]',
  archived: 'bg-[#F5F1EA] text-[#8A8378]',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  pending: 'Pendiente',
  published: 'Publicado',
  rejected: 'Rechazado',
  archived: 'Archivado',
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status] ?? 'bg-[#F5F1EA] text-[#57514A]'}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
