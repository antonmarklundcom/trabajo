'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import {
  isTrackablePath,
  sanitizePageLocation,
  sanitizeReferrer,
} from '@/lib/analytics-location';

type GtagWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
} & Record<string, unknown>;

// Module scope rather than a ref: one browser page load is one GA session of
// this component, and a ref would reset if the Suspense boundary above ever
// remounted it. `lastLocation` is also what makes React's dev-mode double
// effect harmless — the second run sees the same location and sends nothing.
let configured = false;
let lastLocation: string | null = null;

/**
 * Sends GA4 page_views by hand, on route change, for public routes only.
 *
 * Why by hand: gtag's default is one automatic page_view per `config` call,
 * built from the raw `document.location`. That cannot be restricted to some
 * routes and cannot be stopped from carrying a token in the query string, so
 * `send_page_view: false` turns it off and this component decides instead.
 *
 * On every navigation, in this order:
 *   1. GA's own opt-out flag (`ga-disable-<id>`) is set for account areas and
 *      cleared for public pages, so nothing — not even an enhanced-measurement
 *      hit switched on in the GA admin — is sent while an account page is open.
 *   2. `page_location` / `page_referrer` are pinned with `gtag('set')` to the
 *      sanitized values, so the two custom events (lib/analytics.ts) inherit
 *      the sanitized URL rather than gtag attaching the raw one.
 *   3. A page_view goes out only when the path is public.
 */
export default function AnalyticsPageViews({ gaId }: { gaId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    const w = window as unknown as GtagWindow;
    // The standard gtag stub. It must push the `arguments` object itself, not
    // an array copy — gtag.js distinguishes its commands by that shape. Set up
    // here rather than in an inline <Script> so the first command queued is
    // our own config, whichever of this effect and the library load runs first.
    w.dataLayer = w.dataLayer || [];
    if (!w.gtag) {
      w.gtag = function gtag() {
        // eslint-disable-next-line prefer-rest-params
        w.dataLayer!.push(arguments);
      };
    }
    const gtag = w.gtag;

    const trackable = isTrackablePath(pathname);
    w[`ga-disable-${gaId}`] = !trackable;

    const origin = window.location.origin;
    const location = sanitizePageLocation(origin, pathname, search);
    if (location === lastLocation) return;
    // First page of the load: the browser's referrer, sanitized. After that,
    // the previous page of this SPA session — already sanitized.
    const referrer = lastLocation ?? sanitizeReferrer(document.referrer, origin);
    lastLocation = location;

    gtag('set', { page_location: location, page_referrer: referrer });
    if (!configured) {
      configured = true;
      gtag('js', new Date());
      gtag('config', gaId, {
        send_page_view: false,
        page_location: location,
        page_referrer: referrer,
      });
    }

    if (trackable) {
      gtag('event', 'page_view', { page_location: location, page_referrer: referrer });
    }
  }, [gaId, pathname, search]);

  return null;
}
