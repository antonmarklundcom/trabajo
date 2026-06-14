import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="text-6xl font-bold text-[#E5E7EB] mb-4">404</div>
      <h1 className="text-2xl font-bold text-[#16181D] mb-3">Página no encontrada</h1>
      <p className="text-[#5B6472] mb-8 max-w-md">
        La página que buscás no existe o fue movida. Pero hay muchos empleos esperándote.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/empleos"
          className="px-6 py-3 rounded-[10px] bg-[#2557D6] text-white font-semibold hover:bg-[#1E47B8] transition-colors"
        >
          Ver todos los empleos
        </Link>
        <Link
          href="/"
          className="px-6 py-3 rounded-[10px] border-2 border-[#2557D6] text-[#2557D6] font-semibold hover:bg-[#EEF3FE] transition-colors"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
