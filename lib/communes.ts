import type { Commune } from './types';

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

export async function fetchCommunesInRadius(
  lat: number,
  lng: number,
  radiusKm: number
): Promise<Commune[]> {
  const resp = await fetch(
    `/api/communes?lat=${lat}&lng=${lng}&radius=${radiusKm}`
  );
  if (!resp.ok) throw new Error('Erreur lors de la récupération des communes');
  return resp.json();
}

export function sortCommunesByDistance(communes: Commune[]): Commune[] {
  return [...communes].sort((a, b) => a.distance - b.distance);
}

export function filterCommunesByRadius(communes: Commune[], maxKm: number): Commune[] {
  return communes.filter((c) => c.distance <= maxKm);
}
