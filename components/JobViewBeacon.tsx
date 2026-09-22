'use client';

import { useEffect } from 'react';

/**
 * Counts one view of the listing being read (POST /api/v1/jobs/[slug]/vista).
 *
 * Client-side on purpose: the job page is statically rendered and cached, so a
 * server-side count would count cache fills, not readers — and a beacon that
 * needs JavaScript is also a cheap bot filter. Once per tab session per
 * listing; the server adds its own per-visitor limit on top. No cookie, no
 * identifier, nothing stored about the visitor.
 */
export default function JobViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `viewed:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // Storage blocked (private mode): count anyway, the server limit holds.
    }
    const url = `/api/v1/jobs/${encodeURIComponent(slug)}/vista`;
    if (!navigator.sendBeacon?.(url)) {
      fetch(url, { method: 'POST', keepalive: true }).catch(() => {});
    }
  }, [slug]);
  return null;
}
