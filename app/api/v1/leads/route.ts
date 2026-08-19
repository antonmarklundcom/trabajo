import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { clientIpOrUnknown } from '@/lib/client-ip';
import { isRateLimited } from '@/lib/public-write-limiter';
import {
  HONEYPOT_FIELD,
  isHoneypotFilled,
  leadSchema,
  processLead,
} from '@/lib/leads';
import { createApplication } from '@/lib/db/admin';

const SILENT_OK = () => NextResponse.json({ ok: true }, { status: 201 });

export async function POST(req: NextRequest) {
  let body: unknown;

  // The leave-page WhatsApp tracker uses navigator.sendBeacon(), which sends a
  // text/plain body; the interactive forms send application/json. Either way we
  // parse JSON from the raw text so both paths are handled identically.
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Bot guard: a filled honeypot or a burst of requests from one IP gets a
  // SILENT 2xx — a non-2xx just teaches the bot to adapt (PLAN.md step 9).
  const ip = clientIpOrUnknown(req.headers);
  if (isHoneypotFilled((body as Record<string, unknown> | null)?.[HONEYPOT_FIELD])) {
    console.warn('[leads] honeypot triggered — rejecting silently', { ip });
    return SILENT_OK();
  }
  if (isRateLimited(ip)) {
    console.warn('[leads] rate limit exceeded — rejecting silently', { ip });
    return SILENT_OK();
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  // Populate source_page from the Referer header when the client didn't send it
  // (e.g. a bare beacon), so leads always carry where they came from.
  const referer = req.headers.get('referer') ?? undefined;
  const lead = parsed.data.sourcePage
    ? parsed.data
    : { ...parsed.data, sourcePage: referer };

  // Insert the applications row BEFORE the webhook fan-out (ARCHITECTURE.md
  // §7/§8, PLAN.md step 8) — but a DB failure must never fail the seeker's
  // submission, so it's swallowed here rather than left to bubble. Only real
  // application-form submissions (name + phone both present) get a row; the
  // leave-page WhatsApp beacon carries neither and is a click, not an
  // application.
  if (lead.type === 'application' && lead.name && lead.phone) {
    try {
      await createApplication({
        jobSlug: lead.jobSlug,
        name: lead.name,
        phone: lead.phone,
        email: lead.email || null,
        message: lead.message || null,
        sourcePage: lead.sourcePage ?? null,
      });
    } catch (err) {
      console.error('[leads] application insert failed —', err);
    }
  }

  // Accept the lead immediately and fan out to the loggers AFTER the response is
  // sent. Logger failures can never block or fail the user's request.
  after(() => processLead(lead));

  return NextResponse.json({ ok: true }, { status: 201 });
}
