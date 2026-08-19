// The only place this app sends email.
//
// Same single-seam discipline as lib/data.ts and lib/blog.ts, for the same
// reason: the properties that matter about an outgoing email — that it degrades
// instead of throwing, that the From address is the configured one, that
// nothing here is marketing — are properties of the SEND, so there is one place
// where all of them are true. A route that calls Resend directly is a route
// that can throw a 500 into a registration because DNS was not ready.
//
// Plain `fetch` rather than the Resend SDK: one dependency fewer, and the API
// is one POST (PLAN-NEXT.md §2 E1).
import 'server-only';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export type SendResult = { sent: boolean; reason?: string };

export type EmailMessage = {
  to: string;
  subject: string;
  /** Plain text. These are transactional notices, not a newsletter. */
  text: string;
};

/**
 * Sends, or explains why it did not. NEVER throws.
 *
 * Unset key = log and skip, exactly like the lead webhooks
 * (`GHL_WEBHOOK_URL` in lib/leads.ts). This is what lets E1 merge and deploy
 * before the DNS records exist: registration must not fail because the mail
 * provider is not wired up yet, and a candidate who never receives a
 * verification email still has a working account (verification gates nothing —
 * PLAN-NEXT.md §2 E1).
 *
 * The same reasoning covers a provider outage, which is why a non-2xx response
 * and a network error are logged rather than raised. The caller's job succeeded
 * or failed on its own terms before this was ever called.
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.warn('[email] RESEND_API_KEY or EMAIL_FROM unset — skipping send', {
      to: redactEmail(message.to),
      subject: message.subject,
    });
    return { sent: false, reason: 'not_configured' };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });

    if (!res.ok) {
      // The body can carry the provider's reason (unverified domain, bad key).
      // Logged, never surfaced to the visitor: it is our configuration problem.
      const detail = await res.text().catch(() => '');
      console.error('[email] provider rejected the send', {
        status: res.status,
        to: redactEmail(message.to),
        subject: message.subject,
        detail: detail.slice(0, 500),
      });
      return { sent: false, reason: `provider_${res.status}` };
    }

    return { sent: true };
  } catch (err) {
    console.error('[email] send failed', {
      to: redactEmail(message.to),
      subject: message.subject,
      error: err instanceof Error ? err.message : String(err),
    });
    return { sent: false, reason: 'network_error' };
  }
}

/**
 * `j***@example.com`. Server logs are not an access-logged surface, and an
 * address is personal data even when the log line exists to debug a bounce.
 */
function redactEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local?.slice(0, 1) ?? ''}***@${domain}`;
}

/**
 * Absolute URLs for links inside emails. A relative path in an email is a dead
 * link, and NEXT_PUBLIC_SITE_URL is already the canonical origin everywhere
 * else in this app.
 */
export function emailUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trabajo.com.py';
  return new URL(path, base).toString();
}
