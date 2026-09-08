'use client';

// The shared employer WhatsApp CTA (PLAN-GROWTH.md §4 W1). Every WhatsApp
// entry point where employer intent shows — homepage band, /publicar,
// /planes, /contacto, the employer dashboard — renders one of these instead
// of hand-rolling an <a href="https://wa.me/...">, so the color, the
// tracked click, and the message are the same one implementation everywhere.
//
// Renders nothing when the number is unset: a caller that needs a fallback
// (a plain /contacto link, for instance) decides that itself, the same
// leave-page-safe pattern WhatsAppButton already uses.
import { track } from '@/lib/analytics';
import {
  employerWhatsAppHref,
  type EmployerIntent,
  type EmployerIntentContext,
} from '@/lib/whatsapp';
import WhatsAppIcon from './icons/WhatsAppIcon';

type Variant = 'button' | 'link' | 'pill';
type Size = 'md' | 'sm';

type Props = {
  intent: EmployerIntent;
  variant?: Variant;
  context?: EmployerIntentContext;
  /** Wires the launch promotion's message variant (PLAN-GROWTH.md §4 P2). */
  promoActive?: boolean;
  label?: string;
  size?: Size;
  /** Overrides the click event's source_page; defaults to the current path. */
  sourcePage?: string;
  className?: string;
  /** Fires after tracking — e.g. closing the mobile menu before the wa.me tab opens. */
  onNavigate?: () => void;
};

const DEFAULT_LABEL: Record<EmployerIntent, string> = {
  publicar: 'Publicá por WhatsApp',
  destacado: 'Consultá precios por WhatsApp',
  empresa: 'Hablemos',
  contacto: 'Escribinos por WhatsApp',
  renovar: 'Renovar por WhatsApp',
};

const VARIANT_CLASS: Record<Variant, Record<Size, string>> = {
  button: {
    md: 'flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-[12px] bg-wa hover:bg-wa-strong text-white font-semibold text-base transition-colors',
    sm: 'flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-[10px] bg-wa hover:bg-wa-strong text-white font-semibold text-sm transition-colors',
  },
  pill: {
    md: 'inline-flex items-center gap-2 px-4 py-2 rounded-full bg-wa hover:bg-wa-strong text-white font-semibold text-sm transition-colors',
    sm: 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-wa hover:bg-wa-strong text-white font-semibold text-xs transition-colors',
  },
  link: {
    md: 'inline-flex items-center gap-1.5 text-wa font-semibold hover:underline text-sm',
    sm: 'inline-flex items-center gap-1 text-wa font-semibold hover:underline text-xs',
  },
};

export default function WhatsAppCta({
  intent,
  variant = 'button',
  context,
  promoActive,
  label,
  size = 'md',
  sourcePage,
  className = '',
  onNavigate,
}: Props) {
  const href = employerWhatsAppHref(intent, { context, promoActive });
  if (!href) return null;

  function handleClick() {
    track('whatsapp_click', {
      audience: 'employer',
      intent,
      source_page: sourcePage ?? (typeof window !== 'undefined' ? window.location.pathname : ''),
    });
    onNavigate?.();
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={`${VARIANT_CLASS[variant][size]} ${className}`}
    >
      {variant !== 'link' && <WhatsAppIcon size={size === 'sm' ? 16 : 20} />}
      {label ?? DEFAULT_LABEL[intent]}
    </a>
  );
}
