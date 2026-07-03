import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="text-6xl font-bold text-[#E7E1D6] mb-4">404</div>
      <h1 className="text-2xl font-bold text-[#1E1B17] mb-3">Página no encontrada</h1>
      <p className="text-[#57514A] mb-8 max-w-md">
        La página que buscás no existe o fue movida. Pero hay muchos empleos esperándote.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/empleos"
          className="px-6 py-3 rounded-[10px] bg-[#C0362A] text-white font-semibold hover:bg-[#9E2A20] transition-colors"
        >
          Ver todos los empleos
        </Link>
        <Link
          href="/"
          className="px-6 py-3 rounded-[10px] border-2 border-[#C0362A] text-[#C0362A] font-semibold hover:bg-[#FBECE9] transition-colors"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
