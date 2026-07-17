import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Términos y condiciones',
  description: 'Condiciones de uso de trabajo.com.py para buscadores de empleo y empleadores.',
};

export default function TerminosPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl sm:text-4xl font-bold text-[#1E1B17] mb-2">Términos y condiciones</h1>
      <p className="text-sm text-[#57514A] mb-10">Última actualización: julio de 2026</p>

      <div className="space-y-8 text-sm text-[#44403A] leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-[#1E1B17] mb-2">1. Aceptación</h2>
          <p>
            Al usar trabajo.com.py aceptás estos términos. Si no estás de acuerdo, te pedimos
            que no uses el sitio.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1E1B17] mb-2">2. El servicio</h2>
          <p>
            trabajo.com.py es un portal que publica ofertas de empleo en Paraguay. El uso del
            sitio para buscar empleo es gratuito y lo seguirá siendo. Los empleadores pueden
            publicar ofertas bajo los planes descritos en{' '}
            <a href="/planes" className="text-[#C0362A] hover:underline">planes y precios</a>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1E1B17] mb-2">3. Publicación de empleos</h2>
          <p>
            Las ofertas enviadas a través de{' '}
            <a href="/publicar" className="text-[#C0362A] hover:underline">/publicar</a> son
            revisadas por nuestro equipo antes de publicarse. Nos reservamos el derecho de
            rechazar, editar o retirar cualquier oferta que consideremos falsa, discriminatoria,
            ilegal o que no cumpla con la legislación laboral paraguaya.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1E1B17] mb-2">4. Responsabilidad del contenido</h2>
          <p>
            El empleador es responsable de la veracidad de la información publicada sobre el
            puesto, la empresa y las condiciones ofrecidas. trabajo.com.py no participa en el
            proceso de selección ni garantiza la contratación.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1E1B17] mb-2">5. Uso aceptable</h2>
          <p>
            No está permitido usar el sitio para publicar contenido fraudulento, ofertas que
            soliciten pagos a los postulantes, ni para recolectar datos de contacto con fines
            distintos a un proceso de selección legítimo.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1E1B17] mb-2">6. Datos personales</h2>
          <p>
            El tratamiento de tus datos se rige por nuestra{' '}
            <a href="/privacidad" className="text-[#C0362A] hover:underline">política de privacidad</a>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1E1B17] mb-2">7. Cambios</h2>
          <p>
            Podemos actualizar estos términos ocasionalmente. Los cambios entran en vigencia al
            publicarse en esta página.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1E1B17] mb-2">8. Contacto</h2>
          <p>
            Para consultas sobre estos términos, escribinos desde la página de{' '}
            <a href="/contacto" className="text-[#C0362A] hover:underline">contacto</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
