import { Suspense } from 'react';
import Script from 'next/script';

import AnalyticsPageViews from './AnalyticsPageViews';

/**
 * GA4 loader, gated on NEXT_PUBLIC_GA_ID — renders nothing when unset so
 * local/dev and pre-launch deploys stay analytics-free.
 *
 * Only the library is loaded here. There is deliberately no inline
 * `gtag('config', id)` snippet any more: that default sends an automatic
 * page_view carrying the raw `document.location` of whatever page the visitor
 * is on — and this component is mounted from the root layout, so that
 * included `/postulante/recuperar/confirmar?token=…` and every other page
 * whose query string is a live credential. Configuration and page_views now
 * live in AnalyticsPageViews, which sends them only for public routes and
 * only with a sanitized location (lib/analytics-location.ts).
 *
 * The Suspense boundary is required, not decorative: AnalyticsPageViews reads
 * useSearchParams(), and a prerendered route whose client tree calls it
 * outside a boundary fails `next build`
 * (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md).
 * The fallback is nothing, because the component renders nothing.
 */
export default function Analytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  if (!gaId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Suspense fallback={null}>
        <AnalyticsPageViews gaId={gaId} />
      </Suspense>
    </>
  );
}
