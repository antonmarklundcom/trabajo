// Monogram palette — warm, brand-adjacent tones. A company with no logo gets a
// stable colour derived from its name, never a generic grey building icon.
const MONO_COLORS = [
  '#C0362A', // brand red
  '#9E2A20', // brand strong
  '#2E7D50', // success green
  '#3E5F9E', // steel blue
  '#B0812C', // gold
  '#8F6620', // gold strong
];

function monoColor(company: string): string {
  let hash = 0;
  for (let i = 0; i < company.length; i++) {
    hash = (hash * 31 + company.charCodeAt(i)) >>> 0;
  }
  return MONO_COLORS[hash % MONO_COLORS.length];
}

function initials(company: string): string {
  const words = company.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

type Props = {
  company: string;
  logo?: string | null;
  size?: number;
  className?: string;
};

export default function CompanyAvatar({ company, logo, size = 48, className = '' }: Props) {
  const radius = Math.round(size * 0.24);

  if (logo) {
    return (
      <div
        className={`flex-shrink-0 overflow-hidden border border-[#E7E1D6] bg-white ${className}`}
        style={{ width: size, height: size, borderRadius: radius }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo}
          alt={`Logo de ${company}`}
          width={size}
          height={size}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`flex-shrink-0 flex items-center justify-center font-extrabold text-white ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: monoColor(company),
        fontSize: size * 0.4,
      }}
      aria-hidden="true"
    >
      {initials(company)}
    </div>
  );
}
