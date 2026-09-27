'use client';

import { useEffect, useState } from 'react';
import WhatsAppButton from './WhatsAppButton';

// The job page's sticky apply bar, below `lg` only (PLAN-GROWTH.md §4 D2).
//
// On a phone the apply actions sit once near the top of the page, then the
// description, then the form. Someone reading a long description has scrolled
// both out of sight exactly when they decide to apply, so this bar appears
// once the top apply block has scrolled ABOVE the viewport, and gets out of
// the way whenever the form or the footer is on screen — never two apply
// surfaces at once, and never covering the footer's links.
//
// It reuses WhatsAppButton, so a tap here is the same `whatsapp_click` (and
// the same leave-page beacon) as the button at the top; there is no third
// event name.

type Props = {
  /** Null when the listing takes applications through the form only. */
  whatsapp: string | null;
  jobTitle: string;
  jobSlug: string;
  citySlug: string;
  categorySlug: string;
  contractType: string;
  /** id of the apply block at the top of the page. */
  topAnchorId: string;
  /** id of the application form section. */
  formAnchorId: string;
};

export default function MobileApplyBar({
  whatsapp,
  jobTitle,
  jobSlug,
  citySlug,
  categorySlug,
  contractType,
  topAnchorId,
  formAnchorId,
}: Props) {
  const [pastTop, setPastTop] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);

  useEffect(() => {
    const top = document.getElementById(topAnchorId);
    const form = document.getElementById(formAnchorId);
    const footer = document.querySelector('footer');
    if (!top || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === top) {
          // Past the top block = not on screen AND above it, not below it
          // (below is impossible here, but a resize can briefly report it).
          setPastTop(!entry.isIntersecting && entry.boundingClientRect.top < 0);
        } else if (entry.target === form) {
          setFormVisible(entry.isIntersecting);
        } else if (entry.target === footer) {
          setFooterVisible(entry.isIntersecting);
        }
      }
    });
    observer.observe(top);
    if (form) observer.observe(form);
    if (footer) observer.observe(footer);
    return () => observer.disconnect();
  }, [topAnchorId, formAnchorId]);

  const visible = pastTop && !formVisible && !footerVisible;

  return (
    <div
      className={`lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur-sm shadow-[0_-4px_16px_rgba(30,27,23,0.08)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-transform duration-200 motion-reduce:transition-none ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
      // Off-screen = out of the tab order and the accessibility tree too.
      aria-hidden={!visible}
      inert={!visible}
    >
      <div className="flex items-center gap-2 max-w-xl mx-auto">
        {whatsapp ? (
          <>
            <div className="flex-1 min-w-0">
              <WhatsAppButton
                whatsapp={whatsapp}
                jobTitle={jobTitle}
                jobSlug={jobSlug}
                citySlug={citySlug}
                categorySlug={categorySlug}
                contractType={contractType}
                label="Postular por WhatsApp"
                size="compact"
              />
            </div>
            <a
              href={`#${formAnchorId}`}
              className="flex-shrink-0 inline-flex items-center justify-center min-h-12 px-4 rounded-[12px] border border-border-strong bg-surface text-ink font-semibold text-[15px] hover:bg-surface-2"
            >
              Formulario
            </a>
          </>
        ) : (
          <a
            href={`#${formAnchorId}`}
            className="flex-1 inline-flex items-center justify-center min-h-12 px-4 rounded-[12px] bg-brand hover:bg-brand-hover text-white font-semibold text-[15px]"
          >
            Postularme a este empleo
          </a>
        )}
      </div>
    </div>
  );
}
