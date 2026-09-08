'use client';

import { track } from '@/lib/analytics';
import { waHref } from '@/lib/whatsapp';
import WhatsAppIcon from './icons/WhatsAppIcon';

type Props = {
  whatsapp: string;
  jobTitle: string;
  jobSlug: string;
  citySlug?: string;
  categorySlug?: string;
  contractType?: string;
};

export default function WhatsAppButton({
  whatsapp,
  jobTitle,
  jobSlug,
  citySlug,
  categorySlug,
  contractType,
}: Props) {
  const message = `Hola, me interesa postularme para el puesto de "${jobTitle}" que vi en trabajo.com.py`;
  const href = waHref(whatsapp, message);

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // Leave-page-safe: fire tracking via sendBeacon in the SAME handler as the
    // navigation, so the click is recorded even as we hand off to WhatsApp.
    const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const sourcePage = typeof window !== 'undefined' ? window.location.pathname : '';
    const payload = JSON.stringify({
      type: 'application',
      jobSlug,
      jobTitle,
      citySlug,
      categorySlug,
      contractType,
      channel: 'whatsapp',
      sourcePage,
    });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(`${siteUrl}/api/v1/leads`, payload);
    }
    track('whatsapp_click', {
      audience: 'seeker',
      intent: 'postularse',
      job_slug: jobSlug,
      category: categorySlug,
      city: citySlug,
      source_page: sourcePage,
    });
    // Allow the link to navigate to WhatsApp
    void e;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-[12px] bg-wa hover:bg-wa-strong text-white font-semibold text-base transition-colors"
    >
      <WhatsAppIcon />
      Postulate por WhatsApp
    </a>
  );
}
