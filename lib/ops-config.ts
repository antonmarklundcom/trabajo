// Which production settings are on, for the /admin "Configuración" card.
//
// Every one of these fails SILENTLY when unset — that is their designed
// degrade (a missing inbox must never fail a visitor's submission) — which is
// exactly why an operator needs to see them somewhere. PLAN-GROWTH.md §8 lists
// them as owner steps; this card is how the owner checks they happened
// without opening hPanel.
//
// Booleans only. No value, no prefix, no length ever leaves this file: the
// page that renders it is behind an admin session, but a secret on a screen is
// still a secret on a screenshot.
import 'server-only';

import { employerDashboardEnabled, employerSignupEnabled } from './flags';
import { launchPromoEnabled } from './promo';

function set(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

export type OpsConfigItem = {
  label: string;
  ok: boolean;
  /** What breaks while this is off, in the operator's terms. */
  whenOff: string;
};

export function getOpsConfig(): { items: OpsConfigItem[]; contactLeadsLost: boolean } {
  const emailConfigured = set('RESEND_API_KEY') && set('EMAIL_FROM');
  const teamInbox = set('LEADS_NOTIFY_EMAIL') && emailConfigured;
  const webhook = set('GHL_WEBHOOK_URL') || set('GOOGLE_SHEETS_WEBHOOK_URL');

  const items: OpsConfigItem[] = [
    {
      label: 'WhatsApp del sitio (NEXT_PUBLIC_WHATSAPP_LEADS)',
      ok: set('NEXT_PUBLIC_WHATSAPP_LEADS'),
      whenOff: 'Todos los botones de WhatsApp para empresas desaparecen.',
    },
    {
      label: 'Google Analytics (NEXT_PUBLIC_GA_ID)',
      ok: set('NEXT_PUBLIC_GA_ID'),
      whenOff: 'No se mide ninguna visita, clic de WhatsApp ni formulario enviado.',
    },
    {
      label: 'Correo saliente (RESEND_API_KEY + EMAIL_FROM)',
      ok: emailConfigured,
      whenOff: 'No sale ningún correo: ni a empresas, ni a postulantes, ni al equipo.',
    },
    {
      label: 'Correo del equipo (LEADS_NOTIFY_EMAIL)',
      ok: teamInbox,
      whenOff: 'Los pedidos de publicación, consultas y avisos pendientes no avisan a nadie.',
    },
    {
      label: 'Webhook de leads (GHL o Google Sheets)',
      ok: webhook,
      whenOff: 'Los leads no llegan al CRM ni a la planilla.',
    },
    {
      label: 'Panel de empresas (EMPLOYER_DASHBOARD_ENABLED)',
      ok: employerDashboardEnabled(),
      whenOff: '/empresa devuelve 404.',
    },
    {
      label: 'Alta de empresas (EMPLOYER_SIGNUP_ENABLED)',
      ok: employerSignupEnabled(),
      whenOff: 'Una empresa no puede crear su cuenta sola.',
    },
    {
      label: 'Promoción de lanzamiento (LAUNCH_PROMO_ENABLED)',
      ok: launchPromoEnabled(),
      whenOff: 'La oferta de Destacado gratis no se muestra ni se aplica.',
    },
  ];

  // A /contacto message is not a job, so unlike /publicar it creates no row in
  // the database: the team inbox and the webhooks are the ONLY places it goes.
  // With all of them off it is accepted, logged to the server console, and
  // gone — worth saying louder than one red dot among eight.
  return { items, contactLeadsLost: !teamInbox && !webhook };
}
