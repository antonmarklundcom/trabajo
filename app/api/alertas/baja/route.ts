// POST /api/alertas/baja — unsubscribe from a job alert.
//
// Two callers, one handler:
//
//   - the button on app/alertas/baja (JSON body `{ token }`);
//   - a mail client's one-click unsubscribe (RFC 8058): it POSTs
//     `List-Unsubscribe=One-Click` as a form body to the URL in the
//     List-Unsubscribe header, which carries the token in its query string
//     (lib/emails/job-alerts.ts).
//
// Either way the alert row is hard-DELETEd and a granted=false consents row is
// appended, in one transaction (lib/db/job-alerts.ts). POST only: no GET is
// exported, so a prefetched link unsubscribes nobody.
//
// Never gated by lib/flags.ts jobAlertsEnabled(): turning the feature off must
// not take away the way out. It needs no secret either — the token is hashed
// and looked up, nothing is derived.
import { NextRequest } from 'next/server';

import { clientIp } from '@/lib/client-ip';
import { isWellFormedJobAlertToken } from '@/lib/job-alert-token';
import { unsubscribeJobAlert } from '@/lib/db/job-alerts';

async function tokenFrom(req: NextRequest): Promise<string | null> {
  const fromQuery = req.nextUrl.searchParams.get('token');
  if (fromQuery) return fromQuery;
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
    return typeof body?.token === 'string' ? body.token : null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const token = await tokenFrom(req);
  if (!isWellFormedJobAlertToken(token)) {
    return Response.json({ error: 'Este enlace no es válido.' }, { status: 400 });
  }

  const removed = await unsubscribeJobAlert(token, {
    ip: clientIp(req.headers),
    userAgent: req.headers.get('user-agent'),
  });

  // Not an error when nothing matched: already unsubscribed, swept, or a
  // second click. "You will not get these emails" is true in every case, and
  // a one-click client only needs a 2xx.
  return Response.json({ ok: true, removed });
}
