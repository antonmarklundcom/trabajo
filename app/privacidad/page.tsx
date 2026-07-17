import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de privacidad',
  description: 'Cómo trabajo.com.py recopila, usa y protege tus datos personales.',
};

export default function PrivacidadPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl sm:text-4xl font-bold text-[#1E1B17] mb-2">Política de privacidad</h1>
      <p className="text-sm text-[#57514A] mb-10">Última actualización: julio de 2026</p>

      <div className="space-y-8 text-sm text-[#44403A] leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-[#1E1B17] mb-2">1. Quiénes somos</h2>
          <p>
            trabajo.com.py es un portal de empleos que conecta a buscadores de trabajo con
            empresas en Paraguay. Esta política explica qué datos recopilamos cuando usás el
            sitio y cómo los tratamos.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1E1B17] mb-2">2. Datos que recopilamos</h2>
          <p className="mb-2">Recopilamos los datos que nos proporcionás directamente al:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Postularte a un empleo (nombre, teléfono, email opcional).</li>
            <li>Publicar un empleo como empleador (nombre de contacto, empresa, teléfono, email, descripción del puesto).</li>
            <li>Contactarnos a través del formulario de contacto o WhatsApp.</li>
          </ul>
          <p className="mt-2">
            No recopilamos información de pago ni datos sensibles. El sitio funciona sin
            necesidad de crear una cuenta.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1E1B17] mb-2">3. Cómo usamos tus datos</h2>
          <p>
            Usamos los datos enviados en los formularios exclusivamente para conectar a
            postulantes con empleadores: procesamos tu postulación o solicitud, y podemos
            contactarte por WhatsApp, email o teléfono en relación con esa consulta. Tu
            información puede registrarse en nuestras herramientas internas de gestión de
            contactos (CRM) y hojas de cálculo para dar seguimiento.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1E1B17] mb-2">4. Con quién compartimos datos</h2>
          <p>
            No vendemos tus datos a terceros. Cuando te postulás a un empleo, tu información de
            contacto se comparte con la empresa que publicó esa oferta, para que pueda
            evaluarte. Usamos proveedores de servicios (por ejemplo, herramientas de CRM y
            hojas de cálculo) únicamente para operar el sitio.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1E1B17] mb-2">5. Analítica</h2>
          <p>
            Podemos usar herramientas de analítica web para entender cómo se usa el sitio (por
            ejemplo, qué páginas se visitan) y así mejorarlo. Estas herramientas no recopilan
            información que te identifique personalmente más allá de datos técnicos estándar
            de navegación.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1E1B17] mb-2">6. Tus derechos</h2>
          <p>
            Podés solicitar en cualquier momento que corrijamos o eliminemos tus datos
            escribiéndonos a través de la página de{' '}
            <a href="/contacto" className="text-[#C0362A] hover:underline">contacto</a>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1E1B17] mb-2">7. Contacto</h2>
          <p>
            Si tenés preguntas sobre esta política, escribinos desde la página de{' '}
            <a href="/contacto" className="text-[#C0362A] hover:underline">contacto</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
