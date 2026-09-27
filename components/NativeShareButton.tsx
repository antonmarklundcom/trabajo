'use client';

import { useSyncExternalStore } from 'react';

// The phone's own share sheet (WhatsApp, Instagram, SMS, whatever the person
// actually uses) where the browser offers one. Renders nothing until mounted
// and nothing at all where navigator.share is missing, so the plain links in
// ShareLinks stay the fallback and the server HTML never promises a button
// that cannot work.
const noopSubscribe = () => () => {};

export default function NativeShareButton({ title, url }: { title: string; url: string }) {
  // A capability, not state: false on the server, the real answer after
  // hydration, and it never changes, so there is nothing to subscribe to.
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === 'function',
    () => false,
  );

  if (!supported) return null;

  async function handleShare() {
    try {
      await navigator.share({ title, url });
    } catch {
      // Dismissing the sheet rejects; there is nothing to report.
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex items-center gap-1.5 text-brand font-semibold hover:underline"
    >
      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
      </svg>
      Compartir
    </button>
  );
}
