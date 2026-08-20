const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-surface-2 text-ink-secondary',
  pending: 'bg-gold-tint text-gold-strong',
  published: 'bg-success-tint text-success',
  rejected: 'bg-error-tint text-error',
  archived: 'bg-surface-2 text-ink-3',
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
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status] ?? 'bg-surface-2 text-ink-secondary'}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
