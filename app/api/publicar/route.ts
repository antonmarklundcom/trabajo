import { after } from 'next/server';
import { createPublicJobSubmission } from '@/lib/db/admin';
import { clientIpOrUnknown } from '@/lib/client-ip';
import {
  HONEYPOT_FIELD,
  employerPostSchema,
  hasLeadDeliveryChannel,
  isHoneypotFilled,
  processLead,
} from '@/lib/leads';
import { isRateLimited } from '@/lib/public-write-limiter';
import { notifyTeamOfLead } from '@/lib/notifications';
import { captureError } from '@/lib/observability';

// The ONE request behind the /publicar form.
//
// It used to be two: the client posted the lead to /api/v1/leads, showed
// success, and then fired this route without awaiting it. Navigating away,
// a dropped connection, or the shared rate limit rejecting the second request
// (which it did silently) all lost the pending job while the employer was told
// it had been received. Now the pending job is written first, the webhook and
// team-email fan-out runs after the response via after(), and success means a
// record exists somewhere the team will see it.
//
// Public, unauthenticated by design — every row this creates lands as
// `status = 'pending'`, which lib/db/queries.ts's visiblePredicate() already
// excludes from every public read (ARCHITECTURE.md §4/§6).

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const ip = clientIpOrUnknown(request.headers);

  // A filled honeypot is a bot: SILENT 2xx, so it learns nothing (PLAN.md step 9).
  if (isHoneypotFilled(body?.[HONEYPOT_FIELD])) {
    console.warn('[publicar] honeypot triggered — rejecting silently', { ip });
    return Response.json({ ok: true }, { status: 201 });
  }
  // The rate limit is NOT silent here. Behind a mobile carrier's NAT a real
  // employer can share an address with many others, and a fake success is a
  // lost customer who thinks they are waiting on us.
  if (isRateLimited(ip)) {
    console.warn('[publicar] rate limit exceeded', { ip });
    return Response.json(
      { error: 'Recibimos muchos envíos seguidos desde tu conexión. Esperá un minuto e intentá de nuevo, o escribinos por WhatsApp.' },
      { status: 429 },
    );
  }

  const parsed = employerPostSchema.safeParse({ ...body, type: 'employer_post' });
  if (!parsed.success) {
    return Response.json({ error: 'Revisá los datos del formulario.' }, { status: 400 });
  }
  const lead = {
    ...parsed.data,
    sourcePage: parsed.data.sourcePage ?? request.headers.get('referer') ?? undefined,
  };

  let jobSaved = false;
  try {
    // Null when the category or city slug does not resolve — nothing to
    // moderate, but the lead below still reaches the team.
    jobSaved = (await createPublicJobSubmission(lead)) !== null;
  } catch (err) {
    captureError('publicar:pending-job-create', err);
  }

  // Without the pending job AND without a webhook or team inbox configured,
  // this submission would exist nowhere. Say so, so the employer can use
  // WhatsApp instead of waiting on a reply that cannot come.
  if (!jobSaved && !hasLeadDeliveryChannel()) {
    return Response.json(
      { error: 'No pudimos registrar tu pedido. Intentá de nuevo en unos minutos o escribinos por WhatsApp.' },
      { status: 503 },
    );
  }

  after(async () => {
    await processLead(lead);
    await notifyTeamOfLead(lead);
  });

  return Response.json({ ok: true }, { status: 201 });
}
