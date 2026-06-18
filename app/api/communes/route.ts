import { NextRequest, NextResponse } from 'next/server';
import { fetchWithCache } from '@/lib/cache';
import type { Commune } from '@/lib/types';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface GeoApiCommune {
  nom: string;
  code: string;
  codesPostaux?: string[];
  centre?: { coordinates: [number, number] };
}

async function fetchViaGeoApiGouv(lat: number, lng: number, radiusKm: number): Promise<Commune[]> {
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const dLat = radiusKm / 111;
  const dLng = dLat / cosLat;

  const minLon = (lng - dLng).toFixed(6);
  const minLat = (lat - dLat).toFixed(6);
  const maxLon = (lng + dLng).toFixed(6);
  const maxLat = (lat + dLat).toFixed(6);

  const url = `https://geo.api.gouv.fr/communes?bbox=${minLon},${minLat},${maxLon},${maxLat}&fields=nom,code,codesPostaux,centre&format=json&geometry=centre`;

  const resp = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) throw new Error(`geo.api.gouv.fr error: ${resp.status}`);

  const data: GeoApiCommune[] = await resp.json();

  const communes: Commune[] = data
    .map((c) => {
      const cLng = c.centre?.coordinates[0];
      const cLat = c.centre?.coordinates[1];
      if (!cLat || !cLng) return null;
      const distance = haversineKm(lat, lng, cLat, cLng);
      if (distance > radiusKm) return null;
      return {
        name: c.nom,
        postalCode: c.codesPostaux?.[0] ?? '',
        lat: cLat,
        lng: cLng,
        distance: Math.round(distance * 10) / 10,
        inseeCode: c.code,
      };
    })
    .filter((c): c is Commune => c !== null)
    .sort((a, b) => a.distance - b.distance);

  return communes;
}

async function fetchViaOverpass(lat: number, lng: number, radiusKm: number): Promise<Commune[]> {
  const radiusM = radiusKm * 1000;
  const query = `[out:json][timeout:20];(node["place"~"^(city|town|village)$"]["name"](around:${radiusM},${lat},${lng}););out;`;

  const mirrors = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];

  let lastError: Error | null = null;
  for (const mirror of mirrors) {
    try {
      const resp = await fetch(mirror, {
        method: 'POST',
        body: query,
        headers: { 'Content-Type': 'text/plain' },
        signal: AbortSignal.timeout(20000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: { elements: { lat?: number; lon?: number; tags?: { name?: string } }[] } =
        await resp.json();
      const seen = new Set<string>();
      return data.elements
        .filter((el) => el.lat && el.lon && el.tags?.name)
        .filter((el) => {
          const key = el.tags!.name!.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((el) => ({
          name: el.tags!.name!,
          postalCode: '',
          lat: el.lat!,
          lng: el.lon!,
          distance: Math.round(haversineKm(lat, lng, el.lat!, el.lon!) * 10) / 10,
        }))
        .sort((a, b) => a.distance - b.distance);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError ?? new Error('Overpass unavailable');
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const lat = parseFloat(params.get('lat') ?? '');
  const lng = parseFloat(params.get('lng') ?? '');
  const radius = parseFloat(params.get('radius') ?? '');

  if (isNaN(lat) || isNaN(lng) || isNaN(radius)) {
    return NextResponse.json({ error: 'Paramètres lat, lng, radius requis' }, { status: 400 });
  }

  const cacheKey = `communes:${lat.toFixed(3)}:${lng.toFixed(3)}:${radius}`;

  try {
    const communes = await fetchWithCache<Commune[]>(cacheKey, async () => {
      try {
        return await fetchViaGeoApiGouv(lat, lng, radius);
      } catch (primaryErr) {
        console.warn('geo.api.gouv.fr failed, trying Overpass:', primaryErr);
        return await fetchViaOverpass(lat, lng, radius);
      }
    });
    return NextResponse.json(communes);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
