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
  /** Defaults to the full call to action; the sticky bar uses a shorter one. */
  label?: string;
  /** `compact` is the sticky bar's height; `default` everywhere else. */
  size?: 'default' | 'compact';
};

export default function WhatsAppButton({
  whatsapp,
  jobTitle,
  jobSlug,
  citySlug,
  categorySlug,
  contractType,
  label = 'Postulate por WhatsApp',
  size = 'default',
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
      className={`flex items-center justify-center gap-2 w-full rounded-[12px] bg-wa hover:bg-wa-strong text-white font-semibold transition-colors ${
        size === 'compact' ? 'min-h-12 px-3 text-sm min-[375px]:text-[15px] whitespace-nowrap' : 'min-h-[52px] px-6 text-base'
      }`}
    >
      <WhatsAppIcon />
      {label}
    </a>
  );
}
