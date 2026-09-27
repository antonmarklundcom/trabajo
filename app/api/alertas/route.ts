// POST /api/alertas — subscribe to "Avisame de empleos nuevos" (double opt-in).
//
// Writes the unconfirmed job_alerts row and its consents row in one
// transaction (lib/db/job-alerts.ts), then mails the confirmation link.
// Nothing is ever sent to the address again until that link is used.
//
// Every accepted request gets the SAME answer — a new alert, a re-send, an
// already-confirmed alert, an address at its cap, a re-send throttled — so the
// form cannot be used to learn whether an address is subscribed to anything.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { clientIp, clientIpOrUnknown } from '@/lib/client-ip';
import { isRateLimited } from '@/lib/public-write-limiter';
import { HONEYPOT_FIELD, isHoneypotFilled } from '@/lib/honeypot';
import { jobAlertsEnabled } from '@/lib/flags';
import { jobAlertsSecret } from '@/lib/job-alert-token';
import { JOB_ALERT_EMAIL_MAX, isValidAlertEmail, normalizeAlertEmail } from '@/lib/job-alerts';
import { getCategory, getCity } from '@/lib/data';
import { markConfirmationSent, subscribeJobAlert } from '@/lib/db/job-alerts';
import { sendEmail } from '@/lib/email';
import { jobAlertConfirmationMessage } from '@/lib/emails/job-alerts';
import { captureError } from '@/lib/observability';

const ACCEPTED = () => NextResponse.json({ ok: true }, { status: 201 });

const schema = z.object({
  email: z.string().max(JOB_ALERT_EMAIL_MAX),
  categoria: z.string().max(100).nullish(),
  ciudad: z.string().max(100).nullish(),
});

export async function POST(req: NextRequest) {
  const secret = jobAlertsSecret();
  if (!jobAlertsEnabled() || !secret) {
    return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const ip = clientIpOrUnknown(req.headers);

  // Same bot guards as the lead form, same order: a filled honeypot gets a
  // silent success, a burst from one address gets told to wait.
  if (isHoneypotFilled((body as Record<string, unknown> | null)?.[HONEYPOT_FIELD])) {
    console.warn('[alertas] honeypot triggered — rejecting silently', { ip });
    return ACCEPTED();
  }
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Recibimos muchos envíos seguidos desde tu conexión. Esperá un minuto e intentá de nuevo.' },
      { status: 429 },
    );
  }

  const parsed = schema.safeParse(body);
  const email = parsed.success ? normalizeAlertEmail(parsed.data.email) : '';
  if (!parsed.success || !isValidAlertEmail(email)) {
    return NextResponse.json({ error: 'Ingresá un email válido.' }, { status: 422 });
  }

  // The filter must name a real categoría / ciudad, resolved through the
  // catalogue seam — a free-text slug would become an alert that can never
  // match, mailed a confirmation for a filter the site does not have.
  const categorySlug = parsed.data.categoria || null;
  const citySlug = parsed.data.ciudad || null;
  const [category, city] = await Promise.all([
    categorySlug ? getCategory(categorySlug) : Promise.resolve(null),
    citySlug ? getCity(citySlug) : Promise.resolve(null),
  ]);
  if ((categorySlug && !category) || (citySlug && !city)) {
    return NextResponse.json({ error: 'Revisá los datos del formulario.' }, { status: 422 });
  }

  let result: Awaited<ReturnType<typeof subscribeJobAlert>>;
  try {
    result = await subscribeJobAlert({
      email,
      categorySlug,
      citySlug,
      ip: clientIp(req.headers),
      userAgent: req.headers.get('user-agent'),
      secret,
    });
  } catch (err) {
    captureError('alertas:subscribe', err);
    return NextResponse.json(
      { error: 'No pudimos guardar tu alerta. Intentá de nuevo en unos minutos.' },
      { status: 503 },
    );
  }

  if (result.action === 'send') {
    // Best effort, like every transactional email here: sendEmail() never
    // throws. An unsent confirmation leaves an unconfirmed row that nothing
    // is ever mailed to and the sweep deletes in 7 days; submitting again
    // re-sends once the throttle allows.
    const sent = await sendEmail(
      jobAlertConfirmationMessage(email, { categorySlug, citySlug }, result.token),
    );
    if (sent.sent) {
      try {
        await markConfirmationSent(result.alertId, new Date());
      } catch (err) {
        captureError('alertas:mark-confirmation-sent', err);
      }
    }
  }

  return ACCEPTED();
}
