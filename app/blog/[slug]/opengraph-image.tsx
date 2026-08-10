import { ImageResponse } from 'next/og';
import { getBlogPost } from '@/lib/blog';

export const alt = 'trabajo.com.py — Blog';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type Params = Promise<{ slug: string }>;

export default async function OgImage({ params }: { params: Params }) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  const title = post?.title ?? 'Blog';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: '#FBF9F6',
          position: 'relative',
          padding: '80px',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <svg width="56" height="56" viewBox="0 0 400 400">
            <g fill="none" stroke="#C0362A" strokeWidth="20">
              <circle cx="200" cy="200" r="184" />
              <path d="M200 16V384M16 200H384M67 67L333 333M333 67L67 333" />
            </g>
            <circle cx="200" cy="200" r="28" fill="#C0362A" />
          </svg>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: '#1E1B17' }}>
            trabajo<span style={{ color: '#8A8378', fontWeight: 600 }}>.com.py</span>
          </div>
        </div>
        <div style={{ display: 'flex', marginTop: 32, fontSize: 60, fontWeight: 800, color: '#1E1B17', lineHeight: 1.2 }}>
          {title}
        </div>
      </div>
    ),
    { ...size },
  );
}
