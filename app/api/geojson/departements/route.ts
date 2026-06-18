import { NextResponse } from 'next/server';
import { fetchWithCache } from '@/lib/cache';
import type { DepartmentsGeoJSON } from '@/lib/types';

const GEOJSON_URL =
  'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements-version-simplifiee.geojson';

export const revalidate = 86400;

export async function GET() {
  try {
    const data = await fetchWithCache<DepartmentsGeoJSON>('departements-geojson', async () => {
      const resp = await fetch(GEOJSON_URL, {
        next: { revalidate: 86400 },
      });
      if (!resp.ok) throw new Error(`Failed to fetch GeoJSON: ${resp.status}`);
      return resp.json();
    });
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=86400' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
