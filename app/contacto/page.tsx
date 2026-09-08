import type { Metadata } from 'next';
import { canonicalFor } from '@/lib/seo';
import { WHATSAPP_HOURS_COPY } from '@/lib/whatsapp';
import ContactForm from '@/components/ContactForm';
import WhatsAppCta from '@/components/WhatsAppCta';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import FloatingWhatsApp from '@/components/FloatingWhatsApp';

export const metadata: Metadata = {
  title: 'Contacto',
  description: 'Contactá al equipo de trabajo.com.py. Estamos para ayudarte.',
  alternates: { canonical: canonicalFor('/contacto') },
};

export default function ContactoPage() {
  return (
    <>
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-ink">Contacto</h1>
        <p className="mt-4 text-base text-ink-secondary">
          ¿Tenés preguntas o querés publicar un empleo? Estamos para ayudarte.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
        {/* WhatsApp contact — first, per the market's channel of choice */}
        <div className="p-5 bg-white rounded-[10px] border border-border flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-[10px] bg-wa/10 text-wa flex items-center justify-center flex-shrink-0">
              <WhatsAppIcon size={24} />
            </div>
            <div>
              <p className="font-semibold text-ink">WhatsApp</p>
              <p className="text-sm text-ink-secondary">{WHATSAPP_HOURS_COPY}</p>
            </div>
          </div>
          <WhatsAppCta intent="contacto" sourcePage="/contacto" />
          <WhatsAppCta
            intent="publicar"
            variant="pill"
            size="sm"
            label="Quiero publicar un empleo"
            sourcePage="/contacto"
            className="self-start"
          />
        </div>

        {/* General contact / form */}
        <div className="flex items-center gap-4 p-5 bg-white rounded-[10px] border border-border">
          <div className="w-12 h-12 rounded-[10px] bg-brand-tint flex items-center justify-center flex-shrink-0">
            <svg width="22" height="22" viewBox="0 0 20 20" fill="#C0362A">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-ink">Formulario</p>
            <p className="text-sm text-ink-secondary">{WHATSAPP_HOURS_COPY}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[10px] border border-border p-6 sm:p-8">
        <h2 className="text-lg font-bold text-ink mb-6">Envianos un mensaje</h2>
        <ContactForm />
      </div>
    </div>
    <FloatingWhatsApp />
    </>
  );
}
