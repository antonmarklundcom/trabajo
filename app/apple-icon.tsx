import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#C0362A',
        }}
      >
        <svg width="140" height="140" viewBox="0 0 400 400">
          <g fill="none" stroke="#FBF9F6" strokeWidth="18">
            <circle cx="200" cy="200" r="176" />
            <circle cx="200" cy="200" r="130" strokeDasharray="6 22" />
            <circle cx="200" cy="200" r="84" />
            <path d="M200 24V376M24 200H376M75 75L325 325M325 75L75 325" />
          </g>
          <circle cx="200" cy="200" r="24" fill="#FBF9F6" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
