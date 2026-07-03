import Link from 'next/link';
import NavMenu from './NavMenu';
import { Wordmark } from './Logo';

export default function Header() {
  return (
    <header className="bg-white border-b border-[#E7E1D6] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href="/"
            className="hover:opacity-80 transition-opacity"
            aria-label="trabajo.com.py — Inicio"
          >
            <Wordmark size={30} />
          </Link>

          {/* Nav */}
          <NavMenu />
        </div>
      </div>
    </header>
  );
}
