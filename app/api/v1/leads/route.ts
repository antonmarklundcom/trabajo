import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { leadSchema, processLead } from '@/lib/leads';

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

  // Accept the lead immediately and fan out to the loggers AFTER the response is
  // sent. Logger failures can never block or fail the user's request.
  after(() => processLead(lead));

  return NextResponse.json({ ok: true }, { status: 201 });
}
