// POST /api/v1/jobs/[slug]/vista — count one view of a public listing.
//
// Called by components/JobViewBeacon.tsx after the page has rendered in a real
// browser, so crawlers that do not run JavaScript are not counted. Always 204:
// the response says nothing about whether the slug exists, whether it was
// counted, or whether this visitor was rate-limited.
import { recordJobView } from '@/lib/data';
import { clientIpOrUnknown } from '@/lib/client-ip';
import { isJobViewLimited } from '@/lib/public-write-limiter';

const SLUG = /^[a-z0-9-]{1,200}$/;

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (SLUG.test(slug) && !isJobViewLimited(clientIpOrUnknown(request.headers), slug)) {
    try {
      await recordJobView(slug);
    } catch (err) {
      // A counter is never worth a 500.
      console.error('[views] record failed', { error: err instanceof Error ? err.message : String(err) });
    }
  }
  return new Response(null, { status: 204 });
}
