import { NextRequest, NextResponse } from 'next/server';
import { leadSchema, processLead } from '@/lib/leads';

export async function POST(req: NextRequest) {
  let body: unknown;

  // sendBeacon sends text/plain; fetch from forms sends application/json
  const contentType = req.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/json')) {
      body = await req.json();
    } else {
      const text = await req.text();
      body = JSON.parse(text);
    }
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

  // Accept the lead immediately. Fan-out to loggers happens in the background.
  // We do NOT await processLead — the response is returned before loggers finish.
  // This ensures logger failures never block the user.
  void processLead(parsed.data);

  return NextResponse.json({ ok: true }, { status: 201 });
}
