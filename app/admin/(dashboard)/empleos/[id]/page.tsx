import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getAdminJob,
  getJobFeatureState,
  listAdminJobImages,
  listCategoryOptions,
  listCityOptions,
  listCompanyOptions,
} from '@/lib/db/admin';
import { imagePublicUrl } from '@/lib/image-storage';
import JobForm, { type JobFormInitial } from '@/components/admin/JobForm';
import JobImageUploader from '@/components/admin/JobImageUploader';
import FeaturePanel from '@/components/admin/FeaturePanel';

export const metadata: Metadata = { title: 'Editar empleo — trabajo.com.py' };

function toDatetimeLocal(date: Date | null): string {
  if (!date) return '';
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditarEmpleoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [job, companies, categories, cities] = await Promise.all([
    getAdminJob(id),
    listCompanyOptions(),
    listCategoryOptions(),
    listCityOptions(),
  ]);
  if (!job) notFound();

  const [images, featureState] = await Promise.all([
    listAdminJobImages(id),
    getJobFeatureState(id),
  ]);
  const initialImages = images.map((img) => ({
    id: img.id,
    url: imagePublicUrl(img.imageKey),
    width: img.width,
    height: img.height,
  }));

  const initial: JobFormInitial = {
    id: job.id,
    title: job.title,
    slug: job.slug,
    companyId: job.companyId,
    categoryId: job.categoryId,
    cityId: job.cityId,
    contractType: job.contractType,
    seniority: job.seniority,
    modality: job.modality,
    salaryMin: job.salaryMin != null ? String(job.salaryMin) : '',
    salaryMax: job.salaryMax != null ? String(job.salaryMax) : '',
    salaryHidden: job.salaryHidden,
    description: job.description,
    whatsapp: job.whatsapp ?? '',
    status: job.status,
    featuredUntil: toDatetimeLocal(job.featuredUntil),
    rejectionReason: job.rejectionReason ?? '',
    originalSlug: job.slug,
    originalStatus: job.status,
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-6">Editar empleo</h1>
      <div className="bg-white rounded-[10px] border border-border p-6 sm:p-8 max-w-3xl">
        <JobForm companies={companies} categories={categories} cities={cities} initial={initial} />
      </div>
      <div className="bg-white rounded-[10px] border border-border p-6 sm:p-8 max-w-3xl mt-6">
        <h2 className="text-lg font-bold text-ink mb-1">Destacado</h2>
        <p className="text-sm text-ink-secondary mb-4">
          Para aplicar una venta hecha por WhatsApp. La fecha se calcula en el servidor.
        </p>
        <FeaturePanel
          jobId={job.id}
          featuredUntil={featureState?.featuredUntil ? featureState.featuredUntil.toISOString() : null}
          isActive={featureState?.active ?? false}
        />
      </div>
      <div className="bg-white rounded-[10px] border border-border p-6 sm:p-8 max-w-3xl mt-6">
        <h2 className="text-lg font-bold text-ink mb-4">Imágenes del empleo</h2>
        <JobImageUploader jobId={job.id} initialImages={initialImages} />
      </div>
    </div>
  );
}
