import { ImageResponse } from 'next/og';

export const alt = 'trabajo.com.py — El portal de empleos de Paraguay';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FBF9F6',
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
        <svg width="150" height="150" viewBox="0 0 400 400">
          <g fill="none" stroke="#C0362A" strokeWidth="12">
            <circle cx="200" cy="200" r="184" />
            <circle cx="200" cy="200" r="136" strokeDasharray="6 20" />
            <circle cx="200" cy="200" r="88" />
            <path d="M200 16V384M16 200H384M67 67L333 333M333 67L67 333" />
          </g>
          <circle cx="200" cy="200" r="18" fill="#C0362A" />
        </svg>
        <div style={{ display: 'flex', marginTop: 36, fontSize: 84, fontWeight: 800, color: '#1E1B17' }}>
          trabajo
          <span style={{ color: '#8A8378', fontWeight: 600 }}>.com.py</span>
        </div>
        <div style={{ display: 'flex', marginTop: 18, fontSize: 34, color: '#57514A' }}>
          El portal de empleos de Paraguay
        </div>
      </div>
    ),
    { ...size },
  );
}
