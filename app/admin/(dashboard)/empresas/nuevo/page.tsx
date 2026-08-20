import type { Metadata } from 'next';
import CompanyForm from '@/components/admin/CompanyForm';

export const metadata: Metadata = { title: 'Nueva empresa — trabajo.com.py' };

export default function NuevaEmpresaPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-6">Nueva empresa</h1>
      <div className="bg-white rounded-[10px] border border-border p-6 sm:p-8 max-w-2xl">
        <CompanyForm />
      </div>
    </div>
  );
}
