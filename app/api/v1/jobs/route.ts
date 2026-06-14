import { NextRequest, NextResponse } from 'next/server';
import { getJobs } from '@/lib/data';
import type { JobFilters } from '@/lib/types';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const filters: JobFilters = {
    q: sp.get('q') ?? undefined,
    categoria: sp.get('categoria') ?? undefined,
    ciudad: sp.get('ciudad') ?? undefined,
    tipo: sp.get('tipo') ?? undefined,
    nivel: sp.get('nivel') ?? undefined,
    modality: sp.get('modalidad') ?? undefined,
    salarioMin: sp.get('salario_min') ? Number(sp.get('salario_min')) : undefined,
    orden: (sp.get('orden') as JobFilters['orden']) ?? 'recientes',
    page: sp.get('page') ? Number(sp.get('page')) : 1,
  };

  const result = await getJobs(filters);
  return NextResponse.json({ ...result, page: filters.page });
}
