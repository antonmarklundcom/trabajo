import { ImageResponse } from 'next/og';
import { getJob, getCity, getClosedJob } from '@/lib/data';
import { formatSalary } from '@/lib/formatters';
import { ogFonts, ogText } from '@/lib/og-fonts';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';

// The share card for one listing — what WhatsApp and Facebook show when a job
// link is pasted, which is how most of them travel.
//
// Read through lib/data.ts like the page it illustrates, so it follows
// DATA_SOURCE and the visibility predicate: a pending or rejected listing gets
// the generic card, never its own title. No company logo and no photo — both
// would be a URL fetched at render time.
//
// Rendered per request (`ƒ` in the build output), on purpose. The page's
// generateStaticParams does not extend to this sibling route, so nothing is
// prerendered per listing — a PNG per listing at build would multiply the
// one-worker Hostinger build (next.config.ts) for images most listings never
// have requested. And no `revalidate` + empty generateStaticParams to make it
// ISR either: this route answers every slug with a card (see loadCard), so
// ISR would write one cached PNG per arbitrary slug anyone requests. A render
// is 50-120 ms warm (measured locally) on top of the cached catalogue read; the
// platforms that fetch it (WhatsApp, Facebook) cache the result themselves.
// It also means the Destacado pill and a listing closing are never stale here.

export const alt = 'Oferta de empleo en trabajo.com.py';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type Card =
  | {
      kind: 'open';
      title: string;
      company: string;
      city: string | null;
      salary: string;
      featured: boolean;
      whatsapp: boolean;
    }
  | { kind: 'closed'; title: string; company: string }
  | { kind: 'unknown' };

async function loadCard(slug: string): Promise<Card> {
  // A share preview never errors: if the catalogue read fails (database
  // unreachable), the crawler still gets a branded card instead of a 500.
  try {
    const job = await getJob(slug);
    if (job) {
      const city = await getCity(job.citySlug);
      const salary = job.salaryHidden ? '' : formatSalary(job.salaryMin, job.salaryMax);
      return {
        kind: 'open',
        title: job.title,
        company: job.company,
        city: city?.name ?? null,
        // formatSalary() says "A convenir" when there are no amounts at all.
        salary: !salary || salary === 'A convenir' ? 'Salario a convenir' : salary,
        featured: !!job.featuredUntil && new Date(job.featuredUntil) > new Date(),
        whatsapp: !!job.whatsapp,
      };
    }
    const closed = await getClosedJob(slug);
    if (closed) return { kind: 'closed', title: closed.title, company: closed.company };
  } catch (error) {
    console.error('[og] job card fell back to the generic card', { slug, error });
  }
  return { kind: 'unknown' };
}

/** Size by length, so a short title fills the card and a long one fits three lines. */
function titleSize(title: string): number {
  if (title.length <= 30) return 72;
  if (title.length <= 55) return 64;
  if (title.length <= 85) return 56;
  return 50;
}

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const card = await loadCard(slug);

  let kicker: string | null;
  let title: string;
  let company = '';
  let meta: string[] = [];
  if (card.kind === 'open') {
    kicker = 'Nueva oferta de empleo';
    title = ogText(card.title) || 'Oferta de empleo';
    company = ogText(card.company);
    meta = [ogText(card.city), ogText(card.salary)].filter(Boolean);
  } else if (card.kind === 'closed') {
    // The tombstone is still a URL people have shared. Its preview must not
    // read like an open listing.
    kicker = 'Oferta cerrada';
    title = 'Esta oferta ya no está disponible';
    company = [ogText(card.title), ogText(card.company)].filter(Boolean).join(' — ');
  } else {
    kicker = null;
    title = 'Encontrá tu próximo trabajo en Paraguay';
    company = 'El portal de empleos de Paraguay';
  }
  const featured = card.kind === 'open' && card.featured;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#FBF9F6',
          padding: '56px 72px 52px',
          position: 'relative',
          fontFamily: 'Inter',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 14,
            background: '#C0362A',
            display: 'flex',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
            {kicker ? (
              <div style={{ display: 'flex', fontSize: 28, color: '#C0362A', fontWeight: 600 }}>
                {kicker}
              </div>
            ) : (
              <div style={{ display: 'flex' }} />
            )}
            {featured ? (
              // Same pill as components/JobCard.tsx: bg-gold, white, uppercase.
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: '#B0812C',
                  color: '#FFFFFF',
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '9px 20px',
                  borderRadius: 999,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="#FFFFFF">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.367 2.446a1 1 0 00-.364 1.118l1.287 3.957c.3.922-.755 1.688-1.54 1.118l-3.366-2.446a1 1 0 00-1.176 0l-3.366 2.446c-.784.57-1.838-.196-1.539-1.118l1.286-3.957a1 1 0 00-.363-1.118L2.34 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
                </svg>
                Destacado
              </div>
            ) : null}
          </div>
          <div
            style={{
              // `block` + lineClamp is what makes Satori truncate with an
              // ellipsis; a flex container just keeps wrapping into the footer.
              display: 'block',
              lineClamp: 3,
              marginTop: 14,
              fontSize: titleSize(title),
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: '#1E1B17',
              lineHeight: 1.12,
            }}
          >
            {title}
          </div>
          {company ? (
            <div
              style={{
                display: 'block',
                lineClamp: 1,
                marginTop: 18,
                fontSize: 34,
                fontWeight: 600,
                color: '#57514A',
              }}
            >
              {company}
            </div>
          ) : null}
          {meta.length > 0 ? (
            <div style={{ display: 'flex', marginTop: 10, fontSize: 30, color: '#57514A' }}>
              {meta.join('  ·  ')}
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <svg width="48" height="48" viewBox="0 0 400 400">
              <g fill="none" stroke="#C0362A" strokeWidth="14">
                <circle cx="200" cy="200" r="180" />
                <circle cx="200" cy="200" r="88" />
                <path d="M200 20V380M20 200H380M73 73L327 327M327 73L73 327" />
              </g>
              <circle cx="200" cy="200" r="20" fill="#C0362A" />
            </svg>
            <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, color: '#1E1B17', letterSpacing: '-0.02em' }}>
              trabajo
              <span style={{ color: '#8A8378', fontWeight: 600 }}>.com.py</span>
            </div>
          </div>
          {card.kind === 'open' ? (
            // Only claim WhatsApp when the listing has a number to apply
            // through; the rest apply through the form on the page.
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: card.whatsapp ? '#12A150' : '#C0362A',
                color: '#FFFFFF',
                fontSize: 26,
                fontWeight: 600,
                padding: '13px 26px',
                borderRadius: 999,
              }}
            >
              {card.whatsapp ? <WhatsAppIcon size={28} /> : null}
              {card.whatsapp ? 'Postulate gratis por WhatsApp' : 'Postulate gratis'}
            </div>
          ) : (
            <div style={{ display: 'flex', fontSize: 28, fontWeight: 600, color: '#57514A' }}>
              Mirá más empleos en trabajo.com.py
            </div>
          )}
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
