'use client';

import { HONEYPOT_FIELD } from '@/lib/leads';

/**
 * Hidden from real users (off-screen, unreachable by Tab, no autofill) but
 * present in the DOM for a bot that fills every field it can see
 * (PLAN.md step 9). Spread `{ [HONEYPOT_FIELD]: value }` into the submitted
 * body so the server-side guard in lib/leads.ts can check it.
 */
export default function HoneypotField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="text"
      name={HONEYPOT_FIELD}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      className="absolute left-[-9999px] top-auto w-px h-px overflow-hidden"
    />
  );
}
