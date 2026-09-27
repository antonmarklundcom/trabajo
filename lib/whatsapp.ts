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
//
// There is deliberately no "publish a job" intent: a chat creates no listing,
// so the team would have to retype it in /admin. Every job goes through the
// /publicar form (/api/publicar → `pending` → /admin approval).
export const EMPLOYER_INTENTS = [
  'destacado',
  'empresa',
  'contacto',
  'renovar',
  // Renewing the LISTING itself (lib/listing-expiry.ts), as opposed to
  // 'renovar' above, which is renewing a Destacado window.
  'renovar_aviso',
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
   * The launch promotion (PLAN-GROWTH.md §4 Batch P) changes the `destacado`
   * message while it is active. Decided in one place so the
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
    case 'destacado':
      // No "¿Cuánto sale?" since /planes prints the price (lib/plans.ts,
      // 2026-09-27). The context suffix is empty for /planes (it
      // passes none) and names the listing when the weekly summary
      // (lib/emails/employer.ts) offers Destacado for one specific aviso, so
      // the team knows which one the chat is about.
      return promoActive
        ? `Hola, quiero destacar un empleo en trabajo.com.py (promoción de lanzamiento).${contextSuffix(context)}`
        : `Hola, quiero destacar un empleo en trabajo.com.py.${contextSuffix(context)}`;
    case 'empresa':
      return 'Hola, quiero consultar por el plan Empresa (varios avisos por mes) en trabajo.com.py.';
    case 'contacto':
      return 'Hola, tengo una consulta sobre trabajo.com.py.';
    case 'renovar':
      return context?.companyName
        ? `Hola, soy de ${context.companyName} y quiero renovar el plan Destacado.`
        : 'Hola, quiero renovar el plan Destacado.';
    case 'renovar_aviso':
      return `Hola, quiero renovar mi aviso en trabajo.com.py.${contextSuffix(context)}`;
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

/**
 * The team writing TO an employer, from /admin — the other direction from every
 * intent above. The number is the job row's own contact number (AGENTS.md: a
 * number comes from the env or from the job row, never from a literal); null
 * when the row has none, and the caller renders no link.
 *
 *   - 'published': the listing just went live. The only notice a /publicar
 *     employer gets — they have no account, so no email reaches them.
 *   - 'listing_renewal' / 'featured_renewal': the renewal conversation the
 *     /admin renewal queue exists to prompt.
 */
export type TeamToEmployerMessage = 'published' | 'listing_renewal' | 'featured_renewal';

export function teamToEmployerHref(
  number: string | null | undefined,
  kind: TeamToEmployerMessage,
  job: { title: string; url?: string },
): string | null {
  // `\D`, not `D`: the old pattern stripped the letter D and left every space,
  // `+` and dash in place, so an admin-typed "+595 981 123 456" became a wa.me
  // link WhatsApp cannot open.
  const digits = number?.replace(/\D/g, '');
  if (!digits) return null;
  const message =
    kind === 'published'
      ? `Hola, te escribimos de trabajo.com.py: tu aviso "${job.title}" ya está publicado${job.url ? `: ${job.url}` : '.'} Si querés que aparezca primero en los resultados, preguntanos por Destacado.`
      : kind === 'listing_renewal'
        ? `Hola, te escribimos de trabajo.com.py: tu aviso "${job.title}" vence pronto. ¿Querés que lo renovemos?`
        : `Hola, te escribimos de trabajo.com.py: el Destacado de tu aviso "${job.title}" vence pronto. ¿Querés renovarlo?`;
  return waHref(digits, message);
}

/**
 * The team answering a /contacto message, from /admin/mensajes or the team
 * email. The number is the one the person typed into the form — read back
 * from their contact_messages row, or from the validated lead in the email —
 * never a literal, the same rule as teamToEmployerHref(). The caller passes it through normalizePhone()
 * (lib/leads.ts) first so a local "0981…" becomes "595981…"; that function is
 * not imported here because this module ships to the browser and lib/leads.ts
 * pulls in zod. Null when nothing dialable is left.
 */
export function teamToContactHref(
  number: string | null | undefined,
  name: string,
): string | null {
  const digits = number?.replace(/\D/g, '');
  if (!digits) return null;
  return waHref(digits, `Hola ${name}, te escribimos de trabajo.com.py por tu consulta…`);
}

/**
 * "Reportar este aviso" on a job page: a chat with the team, prefilled with
 * the listing, so a seeker who smells a scam (a fee to apply, a request for
 * documents up front) can say so in one tap. Null when the site number is not
 * configured — the link is omitted rather than pointed at nobody.
 */
export function reportListingHref(jobTitle: string, url: string): string | null {
  const number = siteWhatsAppNumber();
  if (!number) return null;
  return waHref(
    number,
    `Hola, quiero reportar un aviso de trabajo.com.py que me parece sospechoso: "${jobTitle}" ${url}`,
  );
}
