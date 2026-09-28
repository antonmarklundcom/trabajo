'use client';

// /admin/precios: the three package prices and their promotions. Validation
// is lib/plans.ts validatePlanPricing(), the same function the route handler
// runs — the form only says what is wrong before the round trip.
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  PLAN_LABELS,
  PLAN_PERIOD,
  PLAN_PRICE_PREFIX,
  formatPlanPrice,
  formatPrice,
  promoEndFromDateInput,
  validatePlanPricing,
  type PlanKey,
  type PlanPricingInput,
} from '@/lib/plans';

export type PricingFormPlan = {
  key: PlanKey;
  priceGs: number;
  promoPriceGs: number | null;
  /** YYYY-MM-DD, or '' when there is none. */
  promoEndsOn: string;
};

type Row = { key: PlanKey; price: string; promoOn: boolean; promoPrice: string; promoEndsOn: string };

function toRow(plan: PricingFormPlan): Row {
  const end = promoEndFromDateInput(plan.promoEndsOn);
  const running = plan.promoPriceGs !== null && end !== null && end.getTime() > Date.now();
  return {
    key: plan.key,
    price: String(plan.priceGs),
    promoOn: running,
    promoPrice: plan.promoPriceGs === null ? '0' : String(plan.promoPriceGs),
    promoEndsOn: running ? plan.promoEndsOn : '',
  };
}

/** Accepts "149.000", "149000" or "Gs. 149.000" — whatever the owner types. */
function parseAmount(value: string): number {
  const digits = value.replace(/[^\d]/g, '');
  return digits === '' ? Number.NaN : Number(digits);
}

function toInput(row: Row): PlanPricingInput {
  return {
    key: row.key,
    priceGs: parseAmount(row.price),
    promo: row.promoOn ? { priceGs: parseAmount(row.promoPrice), endsOn: row.promoEndsOn } : null,
  };
}

const inputClass =
  'w-full px-3 py-2.5 rounded-[10px] border border-border bg-white text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand/30';

export default function PricingForm({ plans }: { plans: PricingFormPlan[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => plans.map(toRow));
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  function update(key: PlanKey, patch: Partial<Row>) {
    setStatus('idle');
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const inputs = rows.map(toInput);
    const found = inputs.flatMap((input) => validatePlanPricing(input));
    setErrors(found);
    if (found.length) return;

    setStatus('saving');
    const res = await fetch('/api/admin/precios', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plans: inputs }),
    }).catch(() => null);
    if (!res?.ok) {
      const data = await res?.json().catch(() => null);
      setErrors([typeof data?.error === 'string' ? data.error : 'No se pudo guardar. Intentá de nuevo.']);
      setStatus('idle');
      return;
    }
    setStatus('saved');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {rows.map((row) => {
        const price = parseAmount(row.price);
        const promoPrice = parseAmount(row.promoPrice);
        return (
          <fieldset key={row.key} className="bg-white rounded-[10px] border border-border p-5">
            <legend className="px-1 text-base font-bold text-ink">{PLAN_LABELS[row.key]}</legend>
            <label className="block text-sm font-medium text-ink mb-1" htmlFor={`price-${row.key}`}>
              {PLAN_PRICE_PREFIX[row.key] ? 'Precio base' : 'Precio regular'} (Gs.){' '}
              <span className="font-normal text-ink-secondary">— {PLAN_PERIOD[row.key]}</span>
            </label>
            <input
              id={`price-${row.key}`}
              inputMode="numeric"
              className={inputClass}
              value={row.price}
              onChange={(e) => update(row.key, { price: e.target.value })}
            />
            {Number.isFinite(price) && (
              <p className="mt-1 text-xs text-ink-secondary">
                Se muestra como {formatPlanPrice(row.key, price)}
              </p>
            )}

            <label className="mt-4 flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={row.promoOn}
                onChange={(e) => update(row.key, { promoOn: e.target.checked })}
              />
              Promoción temporal
            </label>

            {row.promoOn && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-ink mb-1" htmlFor={`promo-${row.key}`}>
                    Precio de promoción (Gs.) — 0 = gratis
                  </label>
                  <input
                    id={`promo-${row.key}`}
                    inputMode="numeric"
                    className={inputClass}
                    value={row.promoPrice}
                    onChange={(e) => update(row.key, { promoPrice: e.target.value })}
                  />
                  {Number.isFinite(promoPrice) && (
                    <p className="mt-1 text-xs text-ink-secondary">Se muestra como {formatPrice(promoPrice)}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-ink mb-1" htmlFor={`ends-${row.key}`}>
                    Termina el (inclusive)
                  </label>
                  <input
                    id={`ends-${row.key}`}
                    type="date"
                    className={inputClass}
                    value={row.promoEndsOn}
                    onChange={(e) => update(row.key, { promoEndsOn: e.target.value })}
                  />
                  <p className="mt-1 text-xs text-ink-secondary">
                    El sitio muestra esta fecha. Extenderla una y otra vez le quita credibilidad.
                  </p>
                </div>
              </div>
            )}
          </fieldset>
        );
      })}

      {errors.length > 0 && (
        <ul className="rounded-[10px] border border-brand/30 bg-brand-tint px-4 py-3 text-sm text-brand space-y-1">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={status === 'saving'}
          className="px-5 py-2.5 rounded-[10px] bg-brand hover:bg-brand-hover text-white text-sm font-semibold disabled:opacity-60"
        >
          {status === 'saving' ? 'Guardando…' : 'Guardar precios'}
        </button>
        {status === 'saved' && <p className="text-sm text-success">Guardado. El sitio ya muestra los precios nuevos.</p>}
      </div>
    </form>
  );
}
