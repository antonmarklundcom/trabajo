import { NextResponse } from 'next/server';
import { getCities } from '@/lib/data';

export async function GET() {
  const cities = await getCities();
  return NextResponse.json(cities);
}
