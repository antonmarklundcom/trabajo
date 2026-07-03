type LogoMarkProps = {
  size?: number;
  className?: string;
};

/**
 * Ñandutí isotype — abstract concentric-circle medallion inspired by the
 * Paraguayan lacework. Uses currentColor so it can be tinted by the parent.
 */
export function LogoMark({ size = 32, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 400 400"
      aria-hidden="true"
      className={className}
    >
      <g fill="none" stroke="currentColor" strokeWidth="12">
        <circle cx="200" cy="200" r="184" />
        <circle cx="200" cy="200" r="136" strokeDasharray="6 20" />
        <circle cx="200" cy="200" r="88" />
        <path d="M200 16V384M16 200H384M67 67L333 333M333 67L67 333" />
      </g>
      <circle cx="200" cy="200" r="18" fill="currentColor" />
    </svg>
  );
}

type WordmarkProps = {
  /** Tone of the ".com.py" suffix and, on dark, the whole wordmark. */
  tone?: 'light' | 'dark';
  markClassName?: string;
  size?: number;
  className?: string;
};

/** Full logo: ñandutí mark + "trabajo.com.py" wordmark. */
export function Wordmark({
  tone = 'light',
  markClassName = 'text-[#C0362A]',
  size = 30,
  className = '',
}: WordmarkProps) {
  const isDark = tone === 'dark';
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} className={markClassName} />
      <span
        className={`font-extrabold tracking-[-0.02em] leading-none ${
          isDark ? 'text-white' : 'text-[#1E1B17]'
        }`}
        style={{ fontSize: size * 0.62 }}
      >
        trabajo
        <span className="font-semibold text-[#8A8378]">.com.py</span>
      </span>
    </span>
  );
}

/**
 * Faint radiating ñandutí medallion used as a hero / band texture.
 * Pure SVG so it stays crisp and light on slow connections.
 */
export function NandutiMotif({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      aria-hidden="true"
      className={className}
    >
      <g fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="200" cy="200" r="190" />
        <circle cx="200" cy="200" r="150" strokeDasharray="2 12" />
        <circle cx="200" cy="200" r="110" />
        <circle cx="200" cy="200" r="70" strokeDasharray="2 10" />
        <circle cx="200" cy="200" r="34" />
        <path d="M200 6V394M6 200H394M58 58L342 342M342 58L58 342M118 20L282 380M282 20L118 380M20 118L380 282M20 282L380 118" />
      </g>
    </svg>
  );
}
