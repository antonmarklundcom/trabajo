import { ImageResponse } from 'next/og';
import { getJob, getCity } from '@/lib/data';
import { formatSalary } from '@/lib/formatters';

export const alt = 'Oferta de empleo en trabajo.com.py';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const job = await getJob(slug);
  const city = job ? await getCity(job.citySlug) : null;

  const title = job?.title ?? 'Oferta de empleo';
  const company = job?.company ?? 'trabajo.com.py';
  const meta = [
    city?.name,
    job && !job.salaryHidden ? formatSalary(job.salaryMin, job.salaryMax) : null,
  ]
    .filter(Boolean)
    .join('  ·  ');

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
          padding: '64px 72px',
          position: 'relative',
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
          <div style={{ display: 'flex', fontSize: 30, color: '#C0362A', fontWeight: 700 }}>
            Nueva oferta de empleo
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 20,
              fontSize: title.length > 40 ? 56 : 68,
              fontWeight: 800,
              color: '#1E1B17',
              lineHeight: 1.15,
            }}
          >
            {title}
          </div>
          <div style={{ display: 'flex', marginTop: 20, fontSize: 38, color: '#57514A' }}>
            {company}
          </div>
          {meta ? (
            <div style={{ display: 'flex', marginTop: 12, fontSize: 30, color: '#8A8378' }}>
              {meta}
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <svg width="52" height="52" viewBox="0 0 400 400">
            <g fill="none" stroke="#C0362A" strokeWidth="14">
              <circle cx="200" cy="200" r="180" />
              <circle cx="200" cy="200" r="88" />
              <path d="M200 20V380M20 200H380M73 73L327 327M327 73L73 327" />
            </g>
            <circle cx="200" cy="200" r="20" fill="#C0362A" />
          </svg>
          <div style={{ display: 'flex', fontSize: 36, fontWeight: 800, color: '#1E1B17' }}>
            trabajo
            <span style={{ color: '#8A8378', fontWeight: 600 }}>.com.py</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
