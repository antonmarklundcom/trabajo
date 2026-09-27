import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Analytics from '@/components/Analytics';
import PromoTopBar from '@/components/PromoTopBar';
import { getPlanPricing } from '@/lib/pricing';
import { activePromo, formatPromoEnd } from '@/lib/plans';

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
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
};

/**
 * The Básico promotion, for the site-wide PromoTopBar. Never allowed to break
 * a page: a pricing read that fails renders the site without the bar.
 */
async function currentPublishPromo() {
  try {
    return activePromo((await getPlanPricing()).basico);
  } catch {
    return null;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const promo = await currentPublishPromo();
  return (
    <html lang="es-PY" className={inter.variable}>
      <body className="min-h-screen flex flex-col bg-page-bg text-ink">
        {promo && (
          <PromoTopBar
            endsAt={promo.endsAt.toISOString()}
            endsLabel={formatPromoEnd(promo.endsAt)}
            free={promo.priceGs === 0}
          />
        )}
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
