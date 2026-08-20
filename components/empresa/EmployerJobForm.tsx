'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import StatusBadge from '@/components/admin/StatusBadge';

type CategoryOption = { id: number; slug: string; name: string };

const CONTRATO_OPTIONS = [
  { value: 'tiempo_completo', label: 'Tiempo completo' },
  { value: 'medio_tiempo', label: 'Medio tiempo' },
  { value: 'temporal', label: 'Temporal' },
  { value: 'pasantia', label: 'Pasantía' },
  { value: 'freelance', label: 'Freelance' },
];

const NIVEL_OPTIONS = [
  { value: 'sin_experiencia', label: 'Sin experiencia' },
  { value: 'junior', label: 'Junior' },
  { value: 'semi_senior', label: 'Semi Senior' },
  { value: 'senior', label: 'Senior' },
];

const MODALIDAD_OPTIONS = [
  { value: 'presencial', label: 'Presencial' },
  { value: 'remoto', label: 'Remoto' },
  { value: 'hibrido', label: 'Híbrido' },
];

export type EmployerJobFormInitial = {
  id?: number;
  title: string;
  categoryId: number | '';
  cityId: number | '';
  contractType: string;
  seniority: string;
  modality: string;
  salaryMin: string;
  salaryMax: string;
  salaryHidden: boolean;
  description: string;
  whatsapp: string;
  status?: string;
};

const EMPTY: EmployerJobFormInitial = {
  title: '',
  categoryId: '',
  cityId: '',
  contractType: 'tiempo_completo',
  seniority: 'junior',
  modality: 'presencial',
  salaryMin: '',
  salaryMax: '',
  salaryHidden: false,
  description: '',
  whatsapp: '',
};

type Props = {
  categories: CategoryOption[];
  cities: CategoryOption[];
  initial?: EmployerJobFormInitial;
};

export default function EmployerJobForm({ categories, cities, initial }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<EmployerJobFormInitial>(initial ?? EMPTY);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function setField<K extends keyof EmployerJobFormInitial>(
    key: K,
    value: EmployerJobFormInitial[K],
  ) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const payload = {
      title: values.title,
      categoryId: Number(values.categoryId),
      cityId: Number(values.cityId),
      contractType: values.contractType,
      seniority: values.seniority,
      modality: values.modality,
      salaryMin: values.salaryMin === '' ? null : Number(values.salaryMin),
      salaryMax: values.salaryMax === '' ? null : Number(values.salaryMax),
      salaryHidden: values.salaryHidden,
      description: values.description,
      whatsapp: values.whatsapp || null,
    };

    const url = values.id ? `/api/empresa/empleos/${values.id}` : '/api/empresa/empleos';
    const method = values.id ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo guardar el empleo.');
        setSubmitting(false);
        return;
      }
      router.push('/empresa/empleos');
      router.refresh();
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {values.status && (
        <div className="flex items-center gap-2 text-sm text-ink-secondary">
          Estado actual: <StatusBadge status={values.status} />
        </div>
      )}

      <Field label="Título" required>
        <input
          type="text"
          required
          value={values.title}
          onChange={(e) => setField('title', e.target.value)}
          className={inputCls()}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Categoría" required>
          <select
            required
            value={values.categoryId}
            onChange={(e) => setField('categoryId', Number(e.target.value))}
            className={inputCls()}
          >
            <option value="">Seleccioná una categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ciudad" required>
          <select
            required
            value={values.cityId}
            onChange={(e) => setField('cityId', Number(e.target.value))}
            className={inputCls()}
          >
            <option value="">Seleccioná una ciudad</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Tipo de contrato">
          <select
            value={values.contractType}
            onChange={(e) => setField('contractType', e.target.value)}
            className={inputCls()}
          >
            {CONTRATO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nivel">
          <select
            value={values.seniority}
            onChange={(e) => setField('seniority', e.target.value)}
            className={inputCls()}
          >
            {NIVEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Modalidad">
          <select
            value={values.modality}
            onChange={(e) => setField('modality', e.target.value)}
            className={inputCls()}
          >
            {MODALIDAD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
        <Field label="Salario mínimo (Gs.)">
          <input
            type="number"
            min={0}
            value={values.salaryMin}
            onChange={(e) => setField('salaryMin', e.target.value)}
            className={inputCls()}
          />
        </Field>
        <Field label="Salario máximo (Gs.)">
          <input
            type="number"
            min={0}
            value={values.salaryMax}
            onChange={(e) => setField('salaryMax', e.target.value)}
            className={inputCls()}
          />
        </Field>
        <label className="flex items-center gap-2 pb-2.5 text-sm text-ink">
          <input
            type="checkbox"
            checked={values.salaryHidden}
            onChange={(e) => setField('salaryHidden', e.target.checked)}
            className="w-4 h-4 rounded border-border text-brand focus:ring-brand"
          />
          Ocultar salario
        </label>
      </div>

      <Field label="Descripción" required>
        <textarea
          required
          rows={8}
          value={values.description}
          onChange={(e) => setField('description', e.target.value)}
          className={`${inputCls()} resize-none`}
        />
      </Field>

      <Field label="WhatsApp (E.164 sin +)">
        <input
          type="tel"
          value={values.whatsapp}
          onChange={(e) => setField('whatsapp', e.target.value)}
          placeholder="595981234567"
          className={inputCls()}
        />
      </Field>

      {values.status && values.status !== 'published' && (
        <p className="text-sm text-gold-strong bg-gold-tint rounded-[10px] px-4 py-3">
          Este empleo va a quedar pendiente de revisión por el equipo de trabajo.com.py antes de
          publicarse.
        </p>
      )}
      {values.status === 'published' && (
        <p className="text-xs text-ink-3">
          Cambiar el título, la descripción, el salario, la categoría, la ciudad, el tipo de
          contrato, el nivel o la modalidad devuelve este empleo a revisión. El WhatsApp se
          actualiza sin afectar la publicación.
        </p>
      )}

      {error && (
        <p className="text-sm text-error bg-error-tint rounded-[10px] px-4 py-3">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-3 rounded-[10px] bg-brand hover:bg-brand-hover text-white font-semibold text-sm transition-colors disabled:opacity-60"
        >
          {submitting ? 'Guardando...' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/empresa/empleos')}
          className="px-6 py-3 rounded-[10px] border border-border text-sm font-medium text-ink-secondary hover:border-brand hover:text-brand transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function inputCls() {
  return 'w-full px-4 py-2.5 rounded-[10px] border border-border text-sm text-ink bg-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink mb-1.5">
        {label}
        {required && <span className="text-error ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
