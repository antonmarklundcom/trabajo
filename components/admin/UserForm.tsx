'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Role = 'admin' | 'editor' | 'employer';
type CompanyOption = { id: number; name: string };

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'editor', label: 'Editor' },
  { value: 'employer', label: 'Empleador' },
];

export type UserFormInitial = {
  id?: number;
  email: string;
  name: string;
  role: Role;
  companyId: number | '';
  isActive: boolean;
};

const EMPTY: UserFormInitial = {
  email: '',
  name: '',
  role: 'editor',
  companyId: '',
  isActive: true,
};

export default function UserForm({
  companies,
  initial,
  currentUserId,
}: {
  companies: CompanyOption[];
  initial?: UserFormInitial;
  currentUserId: number;
}) {
  const router = useRouter();
  const isEdit = !!initial?.id;
  const [values, setValues] = useState<UserFormInitial>(initial ?? EMPTY);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function setField<K extends keyof UserFormInitial>(key: K, value: UserFormInitial[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  const isSelf = isEdit && initial?.id === currentUserId;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const companyId = values.role === 'employer' && values.companyId ? Number(values.companyId) : null;

    try {
      let res: Response;
      if (isEdit) {
        res = await fetch(`/api/admin/usuarios/${values.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: values.name,
            role: values.role,
            companyId,
            isActive: values.isActive,
          }),
        });
      } else {
        res = await fetch('/api/admin/usuarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: values.email,
            name: values.name,
            role: values.role,
            companyId,
            password,
          }),
        });
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo guardar el usuario.');
        setSubmitting(false);
        return;
      }
      router.push('/admin/usuarios');
      router.refresh();
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Email" required>
          <input
            type="email"
            required
            disabled={isEdit}
            value={values.email}
            onChange={(e) => setField('email', e.target.value)}
            className={inputCls(isEdit)}
          />
        </Field>
        <Field label="Nombre" required>
          <input
            type="text"
            required
            value={values.name}
            onChange={(e) => setField('name', e.target.value)}
            className={inputCls()}
          />
        </Field>
      </div>

      {!isEdit && (
        <Field label="Contraseña" required>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls()}
          />
        </Field>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Rol" required>
          <select
            required
            disabled={isSelf}
            value={values.role}
            onChange={(e) => setField('role', e.target.value as Role)}
            className={inputCls(isSelf)}
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        {values.role === 'employer' && (
          <Field label="Empresa">
            <select
              value={values.companyId}
              onChange={(e) => setField('companyId', e.target.value ? Number(e.target.value) : '')}
              className={inputCls()}
            >
              <option value="">Sin empresa asignada</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      {isEdit && (
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            disabled={isSelf}
            checked={values.isActive}
            onChange={(e) => setField('isActive', e.target.checked)}
            className="w-4 h-4 rounded border-border text-brand focus:ring-brand"
          />
          Cuenta activa
        </label>
      )}

      {isSelf && (
        <p className="text-xs text-ink-3">
          No podés cambiar tu propio rol ni desactivar tu propia cuenta desde acá.
        </p>
      )}

      {isEdit && (
        <p className="text-xs text-ink-3">
          El cambio de contraseña se hace con{' '}
          <code className="bg-surface-2 px-1 py-0.5 rounded">npm run user:password</code>, no desde
          este panel (ARCHITECTURE.md §5).
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
          onClick={() => router.push('/admin/usuarios')}
          className="px-6 py-3 rounded-[10px] border border-border text-sm font-medium text-ink-secondary hover:border-brand hover:text-brand transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function inputCls(disabled?: boolean) {
  return `w-full px-4 py-2.5 rounded-[10px] border border-border text-sm text-ink bg-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 ${disabled ? 'opacity-60 cursor-not-allowed bg-surface-2' : ''}`;
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
