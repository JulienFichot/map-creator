export interface FontOption {
  id: string;
  label: string;
  stack: string;
  googleParam: string | null;
  preview: string;
}

export interface CustomFont {
  id: string;
  label: string;
  stack: string;
  type: 'google' | 'local';
  googleParam?: string;
  svgEmbed?: string;
}

// ── Built-in curated fonts ────────────────────────────────────────────────────

export const FONTS: FontOption[] = [
  { id: 'helvetica', label: 'Helvetica', stack: "'Helvetica Neue', Helvetica, Arial, sans-serif", googleParam: null, preview: 'Aa' },
  { id: 'montserrat', label: 'Montserrat', stack: "'Montserrat', sans-serif", googleParam: 'Montserrat:wght@400;600;800', preview: 'Aa' },
  { id: 'oswald', label: 'Oswald', stack: "'Oswald', sans-serif", googleParam: 'Oswald:wght@400;500;700', preview: 'Aa' },
  { id: 'roboto', label: 'Roboto', stack: "'Roboto', sans-serif", googleParam: 'Roboto:wght@400;700;900', preview: 'Aa' },
  { id: 'playfair', label: 'Playfair Display', stack: "'Playfair Display', Georgia, serif", googleParam: 'Playfair+Display:wght@400;700;900', preview: 'Aa' },
  { id: 'raleway', label: 'Raleway', stack: "'Raleway', sans-serif", googleParam: 'Raleway:wght@400;700;800', preview: 'Aa' },
  { id: 'bebas', label: 'Bebas Neue', stack: "'Bebas Neue', sans-serif", googleParam: 'Bebas+Neue', preview: 'Aa' },
  { id: 'lato', label: 'Lato', stack: "'Lato', sans-serif", googleParam: 'Lato:wght@400;700;900', preview: 'Aa' },
];

export const DEFAULT_FONT = FONTS[0];

// ── Custom font registry (module-level, shared across all components) ─────────

const customFontRegistry = new Map<string, CustomFont>();

export function registerCustomFont(font: CustomFont): void {
  customFontRegistry.set(font.stack, font);
}

export function getCustomFonts(): CustomFont[] {
  return Array.from(customFontRegistry.values());
}

export function getFontSVGEmbed(fontFamily: string): string | null {
  const custom = customFontRegistry.get(fontFamily);
  if (custom?.type === 'local' && custom.svgEmbed) {
    const name = fontFamily.replace(/['"]/g, '').split(',')[0].trim();
    return `@font-face { font-family: '${name}'; src: url('${custom.svgEmbed}'); font-weight: 100 900; }`;
  }
  if (custom?.type === 'google' && custom.googleParam) {
    return `@import url('https://fonts.googleapis.com/css2?family=${custom.googleParam}&display=swap');`;
  }
  const builtin = FONTS.find((f) => f.stack === fontFamily);
  if (builtin?.googleParam) {
    return `@import url('https://fonts.googleapis.com/css2?family=${builtin.googleParam}&display=swap');`;
  }
  return null;
}

export function getFontByStack(stack: string): FontOption | CustomFont {
  return FONTS.find((f) => f.stack === stack) ?? customFontRegistry.get(stack) ?? DEFAULT_FONT;
}

export function loadGoogleFont(font: FontOption): void {
  if (!font.googleParam || typeof document === 'undefined') return;
  const id = `gfont-${font.id}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${font.googleParam}&display=swap`;
  document.head.appendChild(link);
}

export async function loadGoogleFontByName(name: string): Promise<CustomFont> {
  if (typeof document === 'undefined') throw new Error('Browser only');
  const param = name.replace(/ /g, '+') + ':wght@400;600;700;800;900';
  const id = `gfont-custom-${name.toLowerCase().replace(/\s+/g, '-')}`;

  if (!document.getElementById(id)) {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${param}&display=swap`;
    document.head.appendChild(link);
    await document.fonts.ready;
  }

  const stack = `'${name}', sans-serif`;
  const font: CustomFont = { id, label: name, stack, type: 'google', googleParam: param };
  registerCustomFont(font);
  return font;
}

export async function loadLocalFont(file: File): Promise<CustomFont> {
  const arrayBuffer = await file.arrayBuffer();
  const rawName = file.name.replace(/\.[^.]+$/, '');
  const fontName = rawName.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const fontFace = new FontFace(fontName, arrayBuffer);
  await fontFace.load();
  document.fonts.add(fontFace);

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'ttf';
  const mimes: Record<string, string> = { ttf: 'font/truetype', otf: 'font/opentype', woff: 'font/woff', woff2: 'font/woff2' };
  const mime = mimes[ext] ?? 'font/truetype';
  const uint8 = new Uint8Array(arrayBuffer);
  let binary = '';
  uint8.forEach((b) => { binary += String.fromCharCode(b); });
  const svgEmbed = `data:${mime};base64,${btoa(binary)}`;

  const stack = `'${fontName}', sans-serif`;
  const id = `local-${fontName.toLowerCase().replace(/\s+/g, '-')}`;
  const font: CustomFont = { id, label: fontName, stack, type: 'local', svgEmbed };
  registerCustomFont(font);
  return font;
}
