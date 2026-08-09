'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type Experience = {
  id: number;
  companyName: string;
  title: string;
  startMonth: string;
  endMonth: string | null;
  isCurrent: boolean;
  description: string | null;
};

type FormValues = {
  companyName: string;
  title: string;
  startMonth: string;
  endMonth: string;
  isCurrent: boolean;
  description: string;
};

const EMPTY: FormValues = {
  companyName: '',
  title: '',
  startMonth: '',
  endMonth: '',
  isCurrent: false,
  description: '',
};

function formatMonth(value: string): string {
  const [year, month] = value.split('-');
  if (!year || !month) return value;
  return `${month}/${year}`;
}

export default function ExperienceManager({ experiences }: { experiences: Experience[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function startAdd() {
    setValues(EMPTY);
    setEditingId(null);
    setAdding(true);
    setError('');
  }

  function startEdit(exp: Experience) {
    setValues({
      companyName: exp.companyName,
      title: exp.title,
      startMonth: exp.startMonth.slice(0, 7),
      endMonth: exp.endMonth ? exp.endMonth.slice(0, 7) : '',
      isCurrent: exp.isCurrent,
      description: exp.description ?? '',
    });
    setEditingId(exp.id);
    setAdding(true);
    setError('');
  }

  function cancel() {
    setAdding(false);
    setEditingId(null);
    setValues(EMPTY);
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        companyName: values.companyName,
        title: values.title,
        startMonth: `${values.startMonth}-01`,
        endMonth: values.isCurrent || !values.endMonth ? null : `${values.endMonth}-01`,
        isCurrent: values.isCurrent,
        description: values.description.trim() ? values.description.trim() : null,
      };
      const url =
        editingId !== null ? `/api/postulante/experiencias/${editingId}` : '/api/postulante/experiencias';
      const res = await fetch(url, {
        method: editingId !== null ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo guardar.');
        setSubmitting(false);
        return;
      }
      cancel();
      router.refresh();
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta experiencia laboral?')) return;
    await fetch(`/api/postulante/experiencias/${id}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {experiences.length === 0 && !adding && (
        <p className="text-sm text-[#57514A]">Todavía no cargaste experiencia laboral.</p>
      )}

      <ul className="space-y-3">
        {experiences.map((exp) => (
          <li key={exp.id} className="border border-[#E7E1D6] rounded-[10px] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-[#1E1B17]">{exp.title}</p>
                <p className="text-sm text-[#57514A]">{exp.companyName}</p>
                <p className="text-xs text-[#8A8378] mt-1">
                  {formatMonth(exp.startMonth)} — {exp.isCurrent ? 'Actual' : exp.endMonth ? formatMonth(exp.endMonth) : ''}
                </p>
                {exp.description && (
                  <p className="text-sm text-[#57514A] mt-2 whitespace-pre-line">{exp.description}</p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => startEdit(exp)}
                  className="text-xs text-[#57514A] hover:text-[#C0362A]"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(exp.id)}
                  className="text-xs text-[#B42318] hover:underline"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {adding ? (
        <form onSubmit={handleSubmit} className="border border-[#E7E1D6] rounded-[10px] p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#1E1B17] mb-1">Puesto</label>
              <input
                type="text"
                required
                value={values.title}
                onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
                className="w-full px-3 py-2 rounded-[8px] border border-[#E7E1D6] text-sm text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1E1B17] mb-1">Empresa</label>
              <input
                type="text"
                required
                value={values.companyName}
                onChange={(e) => setValues((v) => ({ ...v, companyName: e.target.value }))}
                className="w-full px-3 py-2 rounded-[8px] border border-[#E7E1D6] text-sm text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1E1B17] mb-1">Desde</label>
              <input
                type="month"
                required
                value={values.startMonth}
                onChange={(e) => setValues((v) => ({ ...v, startMonth: e.target.value }))}
                className="w-full px-3 py-2 rounded-[8px] border border-[#E7E1D6] text-sm text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1E1B17] mb-1">Hasta</label>
              <input
                type="month"
                disabled={values.isCurrent}
                value={values.endMonth}
                onChange={(e) => setValues((v) => ({ ...v, endMonth: e.target.value }))}
                className="w-full px-3 py-2 rounded-[8px] border border-[#E7E1D6] text-sm text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A] disabled:opacity-50"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-[#1E1B17]">
            <input
              type="checkbox"
              checked={values.isCurrent}
              onChange={(e) => setValues((v) => ({ ...v, isCurrent: e.target.checked, endMonth: '' }))}
              className="w-4 h-4 rounded border-[#E7E1D6] text-[#C0362A] focus:ring-[#C0362A]"
            />
            Trabajo actual
          </label>
          <div>
            <label className="block text-xs font-medium text-[#1E1B17] mb-1">
              Descripción (opcional)
            </label>
            <textarea
              rows={3}
              maxLength={2000}
              value={values.description}
              onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
              className="w-full px-3 py-2 rounded-[8px] border border-[#E7E1D6] text-sm text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A]"
            />
          </div>

          {error && <p className="text-sm text-[#B42318]">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="py-2 px-4 rounded-[8px] bg-[#C0362A] hover:bg-[#9E2A20] text-white text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {submitting ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="py-2 px-4 rounded-[8px] border border-[#E7E1D6] text-sm text-[#57514A] hover:border-[#C0362A]"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={startAdd}
          className="text-sm font-medium text-[#C0362A] hover:underline"
        >
          + Agregar experiencia laboral
        </button>
      )}
    </div>
  );
}
