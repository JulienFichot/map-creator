import type { GeocodedCity } from './types';

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state_district?: string;
    state?: string;
    postcode?: string;
    country_code?: string;
    'ISO3166-2-lvl6'?: string;
    'ISO3166-2-lvl4'?: string;
  };
}

function extractDepartmentCode(result: NominatimResult): string {
  const iso6 = result.address['ISO3166-2-lvl6'];
  if (iso6) {
    const match = iso6.match(/FR-(\d{2,3}|2A|2B)/);
    if (match) return match[1];
  }
  const postcode = result.address.postcode;
  if (postcode && postcode.length >= 2) {
    const code = postcode.substring(0, 2);
    if (code === '97') return postcode.substring(0, 3);
    return code;
  }
  return '';
}

export async function geocodeCity(cityName: string): Promise<GeocodedCity> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)},France&format=json&addressdetails=1&limit=5&countrycodes=fr`;

  const resp = await fetch(url, {
    headers: { 'Accept-Language': 'fr', 'User-Agent': 'MapCreator/1.0' },
  });

  if (!resp.ok) throw new Error(`Nominatim error: ${resp.status}`);

  const results: NominatimResult[] = await resp.json();
  if (!results.length) throw new Error(`Ville introuvable: ${cityName}`);

  const r = results[0];
  const addr = r.address;
  const name = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? cityName;
  const departmentCode = extractDepartmentCode(r);

  return {
    name,
    displayName: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    departmentCode,
    departmentName: addr.county ?? addr.state_district ?? '',
    region: addr.state ?? '',
  };
}
