// The one shared WhatsApp module (PLAN-GROWTH.md §1, §4 Batch W W1).
//
// Every `https://wa.me/` link on the site is built here — `waHref()` is the
// only place that literal appears (`npm run whatsapp:verify` asserts it from
// source). A page or component that concatenates the URL itself is exactly
// the config drift (PLAN-GROWTH.md §2.2 finding 8/9) this module exists to
// close: one place to change the URL shape, one place to change a message,
// one place that reads the number.
//
// Not `server-only`: `WhatsAppCta` is a client component and needs the intent
// messages at render time, and the number itself is `NEXT_PUBLIC_*` already
// (it ships in the bundle either way).
//
// `WHATSAPP_HOURS_COPY` is the ONE time promise the whole site makes (owner
// decision D1, PLAN-GROWTH.md §7): never "en minutos", never an applicant
// count — only the team's own response time, stated once and reused
// everywhere so it can't drift page to page.
export const WHATSAPP_HOURS_COPY =
  'Te respondemos el mismo día hábil (lunes a viernes, 8 a 18).';

/** `NEXT_PUBLIC_WHATSAPP_LEADS`, or null when unset/blank. */
export function siteWhatsAppNumber(): string | null {
  const number = process.env.NEXT_PUBLIC_WHATSAPP_LEADS?.trim();
  return number ? number : null;
}

/**
 * The only place `https://wa.me/` is written. `number` is optional so the
 * same helper builds both a direct chat (`WhatsAppButton`, the employer
 * intents) and the numberless share link (`ShareLinks`, "send this page to
 * anyone").
 */
export function waHref(number: string | null | undefined, message: string): string {
  return `https://wa.me/${number ?? ''}?text=${encodeURIComponent(message)}`;
}

/**
 * Every WhatsApp entry point where employer intent shows (PLAN-GROWTH.md
 * §2.3). One prefilled message per intent so the team knows what the chat is
 * about before opening it — the whole point of offering WhatsApp first.
 */
export const EMPLOYER_INTENTS = [
  'publicar',
  'destacado',
  'empresa',
  'contacto',
  'renovar',
] as const;

export type EmployerIntent = (typeof EMPLOYER_INTENTS)[number];

/** Context folded into a message when the caller has it (job, company). */
export type EmployerIntentContext = {
  jobTitle?: string;
  companyName?: string;
};

export type EmployerIntentOptions = {
  context?: EmployerIntentContext;
  /**
   * The launch promotion (PLAN-GROWTH.md §4 Batch P) changes the `publicar`
   * and `destacado` messages while it is active. Decided in one place so the
   * quota logic never leaks into a page component.
   */
  promoActive?: boolean;
};

function contextSuffix(context: EmployerIntentContext | undefined): string {
  if (!context) return '';
  const parts = [
    context.jobTitle ? `Puesto: ${context.jobTitle}` : null,
    context.companyName ? `Empresa: ${context.companyName}` : null,
  ].filter((part): part is string => part !== null);
  return parts.length ? ` ${parts.join(' · ')}` : '';
}

function employerIntentMessage(intent: EmployerIntent, options: EmployerIntentOptions = {}): string {
  const { context, promoActive = false } = options;
  switch (intent) {
    case 'publicar':
      return promoActive
        ? 'Hola, quiero publicar un empleo con la promoción de lanzamiento (Destacado 90 días gratis).'
        : `Hola, quiero publicar un empleo en trabajo.com.py.${contextSuffix(context)}`;
    case 'destacado':
      // Kept identical to the /planes message shipped in PR #78; only the
      // promo suffix is new.
      return promoActive
        ? 'Hola, quiero destacar un empleo en trabajo.com.py. ¿Cuánto sale? (promoción de lanzamiento)'
        : 'Hola, quiero destacar un empleo en trabajo.com.py. ¿Cuánto sale?';
    case 'empresa':
      return 'Hola, quiero consultar por el plan Empresa (varios avisos por mes) en trabajo.com.py.';
    case 'contacto':
      return 'Hola, tengo una consulta sobre trabajo.com.py.';
    case 'renovar':
      return context?.companyName
        ? `Hola, soy de ${context.companyName} y quiero renovar el plan Destacado.`
        : 'Hola, quiero renovar el plan Destacado.';
  }
}

/** `null` when `NEXT_PUBLIC_WHATSAPP_LEADS` is unset — callers decide the fallback. */
export function employerWhatsAppHref(
  intent: EmployerIntent,
  options?: EmployerIntentOptions,
): string | null {
  const number = siteWhatsAppNumber();
  return number ? waHref(number, employerIntentMessage(intent, options)) : null;
}
