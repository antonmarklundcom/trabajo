'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  initial: {
    name: string;
    phone: string;
    cityId: number | null;
    headline: string | null;
    notifyOnStatusChange: boolean;
  };
  cities: { id: number; name: string }[];
};

export default function ProfileForm({ initial, cities }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [cityId, setCityId] = useState(initial.cityId ? String(initial.cityId) : '');
  const [headline, setHeadline] = useState(initial.headline ?? '');
  const [notifyOnStatusChange, setNotifyOnStatusChange] = useState(initial.notifyOnStatusChange);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaved(false);
    setSubmitting(true);
    try {
      const res = await fetch('/api/postulante/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          cityId: cityId ? Number(cityId) : null,
          headline: headline.trim() ? headline.trim() : null,
          notifyOnStatusChange,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo guardar.');
        setSubmitting(false);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError('Error de conexión. Intentá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[#1E1B17] mb-1.5">Nombre completo</label>
        <input
          type="text"
          required
          minLength={2}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-2.5 rounded-[10px] border border-[#E7E1D6] text-base text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A] focus:ring-2 focus:ring-[#C0362A]/20"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#1E1B17] mb-1.5">
          Titular
          <span className="text-[#8A8378] font-normal"> (opcional, lo escribís vos)</span>
        </label>
        <input
          type="text"
          maxLength={200}
          placeholder="Ej: Vendedor con 3 años de experiencia"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          className="w-full px-4 py-2.5 rounded-[10px] border border-[#E7E1D6] text-base text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A] focus:ring-2 focus:ring-[#C0362A]/20"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#1E1B17] mb-1.5">Teléfono / WhatsApp</label>
        <input
          type="tel"
          required
          minLength={6}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full px-4 py-2.5 rounded-[10px] border border-[#E7E1D6] text-base text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A] focus:ring-2 focus:ring-[#C0362A]/20"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#1E1B17] mb-1.5">Ciudad</label>
        <select
          value={cityId}
          onChange={(e) => setCityId(e.target.value)}
          className="w-full px-4 py-2.5 rounded-[10px] border border-[#E7E1D6] text-base text-[#1E1B17] bg-white focus:outline-none focus:border-[#C0362A] focus:ring-2 focus:ring-[#C0362A]/20"
        >
          <option value="">Preferís no decirlo</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="flex items-start gap-3 text-sm text-[#1E1B17]">
          <input
            type="checkbox"
            checked={notifyOnStatusChange}
            onChange={(e) => setNotifyOnStatusChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[#E7E1D6] accent-[#C0362A]"
          />
          <span>
            Avisarme por correo cuando una empresa quiera contactarme
            <span className="block text-xs text-[#8A8378] mt-0.5">
              Es el único aviso que mandamos sobre tus postulaciones.
            </span>
          </span>
        </label>
      </div>

      {error && (
        <p className="text-sm text-[#B42318] bg-[#FCEBEA] rounded-[10px] px-4 py-3">{error}</p>
      )}
      {saved && !error && (
        <p className="text-sm text-[#1E6B3E] bg-[#E8F3EC] rounded-[10px] px-4 py-3">
          Perfil actualizado.
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="py-2.5 px-6 rounded-[10px] bg-[#C0362A] hover:bg-[#9E2A20] text-white font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </form>
  );
}
