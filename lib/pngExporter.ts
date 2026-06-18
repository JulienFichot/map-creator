import type { MapConfig, DepartmentsGeoJSON, ExportSize } from './types';
import { generateSVG } from './svgExporter';

const SIZE_MAP: Record<ExportSize, number> = {
  '1200': 1200,
  '2000': 2000,
  '3000': 3000,
};

export async function exportPNG(
  config: MapConfig,
  geojson: DepartmentsGeoJSON,
  neighborCodes: Set<string>,
  exportSize: ExportSize = '2000',
  outline = false
): Promise<void> {
  const size = SIZE_MAP[exportSize];
  const svgString = generateSVG(config, geojson, neighborCodes, size, undefined, outline);
  const blob = await svgToBlob(svgString, size, outline);
  const suffix = outline ? '-detoure' : '';
  downloadBlob(blob, `carte-${config.cityName.toLowerCase()}-${config.radius}km-${size}px${suffix}.png`);
}

async function svgToBlob(svgString: string, size: number, transparent = false): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('Canvas context unavailable'));

    if (!transparent) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
    }

    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas to blob failed'));
      }, 'image/png');
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG to image conversion failed'));
    };

    img.src = url;
  });
}

export async function exportWEBP(
  config: MapConfig,
  geojson: DepartmentsGeoJSON,
  neighborCodes: Set<string>,
  exportSize: ExportSize = '2000'
): Promise<void> {
  const size = SIZE_MAP[exportSize];
  const svgString = generateSVG(config, geojson, neighborCodes, size);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  const img = new Image();
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  await new Promise<void>((resolve, reject) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG'));
    };
    img.src = url;
  });

  canvas.toBlob(
    (blob) => {
      if (blob) downloadBlob(blob, `carte-${config.cityName.toLowerCase()}-${config.radius}km-${size}px.webp`);
    },
    'image/webp',
    0.92
  );
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
