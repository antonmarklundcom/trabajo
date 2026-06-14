import Link from 'next/link';
import NavMenu from './NavMenu';

export default function Header() {
  return (
    <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 text-[#2557D6] font-bold text-xl tracking-tight hover:opacity-80 transition-opacity"
          >
            <span
              className="inline-flex items-center justify-center w-8 h-8 rounded-[10px] bg-[#2557D6] text-white text-sm font-bold"
              aria-hidden="true"
            >
              T
            </span>
            <span>trabajo.com.py</span>
          </Link>

          {/* Nav */}
          <NavMenu />
        </div>
      </div>
    </header>
  );
}
