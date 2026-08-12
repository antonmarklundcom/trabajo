import type { Metadata } from 'next';
import BlogForm from '@/components/admin/BlogForm';

export const metadata: Metadata = { title: 'Nuevo artículo — trabajo.com.py' };

export default function NuevoArticuloPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1E1B17] mb-6">Nuevo artículo</h1>
      <div className="bg-white rounded-[10px] border border-[#E7E1D6] p-6 sm:p-8 max-w-3xl">
        <BlogForm />
      </div>
      <p className="text-sm text-[#8A8378] mt-4 max-w-3xl">
        Guardá el artículo primero — la portada se sube después, desde la pantalla de edición.
      </p>
    </div>
  );
}
