import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter-loaded',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'trabajo.com.py — Encontrá tu próximo empleo en Paraguay',
    template: '%s | trabajo.com.py',
  },
  description:
    'El portal de empleos de Paraguay. Buscá trabajo en Asunción, Ciudad del Este, Encarnación y todo el país. Gratuito para candidatos.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://trabajo.com.py'),
  openGraph: {
    siteName: 'trabajo.com.py',
    locale: 'es_PY',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-PY" className={inter.variable}>
      <body className="min-h-screen flex flex-col bg-[#FBF9F6] text-[#1E1B17]">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
