import { NextRequest, NextResponse } from 'next/server';
import { geocodeCity } from '@/lib/geocoder';
import { fetchWithCache } from '@/lib/cache';

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get('city');
  if (!city) {
    return NextResponse.json({ error: 'Paramètre city manquant' }, { status: 400 });
  }

  try {
    const result = await fetchWithCache(`geocode:${city.toLowerCase().trim()}`, () =>
      geocodeCity(city)
    );
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur de géocodage';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
