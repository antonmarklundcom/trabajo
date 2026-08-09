'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Option = { id: number; name: string };
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

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Borrador' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'published', label: 'Publicado' },
  { value: 'rejected', label: 'Rechazado' },
  { value: 'archived', label: 'Archivado' },
];

export type JobFormInitial = {
  id?: number;
  title: string;
  slug: string;
  companyId: number | '';
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
  status: string;
  featuredUntil: string;
  rejectionReason: string;
  originalSlug?: string;
  originalStatus?: string;
};

const EMPTY: JobFormInitial = {
  title: '',
  slug: '',
  companyId: '',
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
  status: 'draft',
  featuredUntil: '',
  rejectionReason: '',
};

type Props = {
  companies: Option[];
  categories: CategoryOption[];
  cities: CategoryOption[];
  initial?: JobFormInitial;
};

export default function JobForm({ companies, categories, cities, initial }: Props) {
  const router = useRouter();
  const [values, setValues] = useState<JobFormInitial>(initial ?? EMPTY);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [needsSlugConfirm, setNeedsSlugConfirm] = useState(false);

  function setField<K extends keyof JobFormInitial>(key: K, value: JobFormInitial[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function submit(confirmSlugChange = false) {
    setSubmitting(true);
    setError('');

    const payload = {
      title: values.title,
      slug: values.slug || undefined,
      companyId: Number(values.companyId),
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
      status: values.status,
      featuredUntil: values.featuredUntil ? new Date(values.featuredUntil).toISOString() : null,
      rejectionReason: values.rejectionReason || null,
      confirmSlugChange,
    };

    const url = values.id ? `/api/admin/empleos/${values.id}` : '/api/admin/empleos';
    const method = values.id ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.status === 409 && data.requiresConfirmation) {
        setNeedsSlugConfirm(true);
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        setError(data.error ?? 'No se pudo guardar el empleo.');
        setSubmitting(false);
        return;
      }

      router.push('/admin/empleos');
      router.refresh();
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
      setSubmitting(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit(false);
  }

  const slugChanged = !!initial?.originalSlug && values.slug && values.slug !== initial.originalSlug;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Título" required>
          <input
            type="text"
            required
            value={values.title}
            onChange={(e) => setField('title', e.target.value)}
            className={inputCls()}
          />
        </Field>
        <Field label="Slug (opcional, se genera del título)">
          <input
            type="text"
            value={values.slug}
            onChange={(e) => {
              setField('slug', e.target.value);
              setNeedsSlugConfirm(false);
            }}
            placeholder={initial?.originalSlug ?? 'se-genera-automaticamente'}
            className={inputCls()}
          />
        </Field>
      </div>

      {slugChanged && initial?.originalStatus === 'published' && (
        <p className="text-sm text-[#B42318] bg-[#FCEBEA] rounded-[10px] px-4 py-3">
          Este empleo está publicado — su slug es una URL pública indexada. Cambiarlo rompe el enlace
          actual; te vamos a pedir confirmación y después hay que configurar un redirect 301 hacia la
          nueva URL.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Empresa" required>
          <select
            required
            value={values.companyId}
            onChange={(e) => setField('companyId', Number(e.target.value))}
            className={inputCls()}
          >
            <option value="">Seleccioná una empresa</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
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
        <label className="flex items-center gap-2 pb-2.5 text-sm text-[#1E1B17]">
          <input
            type="checkbox"
            checked={values.salaryHidden}
            onChange={(e) => setField('salaryHidden', e.target.checked)}
            className="w-4 h-4 rounded border-[#E7E1D6] text-[#C0362A] focus:ring-[#C0362A]"
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="WhatsApp (E.164 sin +)">
          <input
            type="tel"
            value={values.whatsapp}
            onChange={(e) => setField('whatsapp', e.target.value)}
            placeholder="595981234567"
            className={inputCls()}
          />
        </Field>
        <Field label="Estado">
          <select
            value={values.status}
            onChange={(e) => setField('status', e.target.value)}
            className={inputCls()}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Destacado hasta">
          <input
            type="datetime-local"
            value={values.featuredUntil}
            onChange={(e) => setField('featuredUntil', e.target.value)}
            className={inputCls()}
          />
        </Field>
      </div>

      {values.status === 'rejected' && (
        <Field label="Motivo de rechazo" required>
          <textarea
            required
            rows={3}
            value={values.rejectionReason}
            onChange={(e) => setField('rejectionReason', e.target.value)}
            placeholder="Explicá por qué se rechaza esta publicación — se le mostrará al empleador."
            className={`${inputCls()} resize-none`}
          />
        </Field>
      )}

      {needsSlugConfirm && (
        <div className="rounded-[10px] border border-[#C0362A]/30 bg-[#FBECE9] p-4 space-y-3">
          <p className="text-sm text-[#1E1B17]">
            Confirmá que querés cambiar el slug de este empleo publicado. Recordá configurar un
            redirect 301 de la URL anterior después de guardar.
          </p>
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={submitting}
            className="px-4 py-2 rounded-[10px] bg-[#C0362A] hover:bg-[#9E2A20] text-white text-sm font-semibold transition-colors disabled:opacity-60"
          >
            Confirmar cambio de slug
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-[#B42318] bg-[#FCEBEA] rounded-[10px] px-4 py-3">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-3 rounded-[10px] bg-[#C0362A] hover:bg-[#9E2A20] text-white font-semibold text-sm transition-colors disabled:opacity-60"
        >
          {submitting ? 'Guardando...' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/empleos')}
          className="px-6 py-3 rounded-[10px] border border-[#E7E1D6] text-sm font-medium text-[#57514A] hover:border-[#C0362A] hover:text-[#C0362A] transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function inputCls() {
  return 'w-full px-4 py-2.5 rounded-[10px] border border-[#E7E1D6] text-sm text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A] focus:ring-2 focus:ring-[#C0362A]/20';
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
      <label className="block text-sm font-medium text-[#1E1B17] mb-1.5">
        {label}
        {required && <span className="text-[#B42318] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
