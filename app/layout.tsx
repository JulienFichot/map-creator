import type { Metadata } from 'next';
import './globals.css';
import 'leaflet/dist/leaflet.css';
import { FONTS } from '@/lib/fonts';

export const metadata: Metadata = {
  title: 'Générateur de Cartes Zone d\'Intervention',
  description: 'Créez des cartes de zones d\'intervention professionnelles pour artisans et entreprises locales. Export SVG, PNG HD, WEBP.',
  keywords: ['carte zone intervention', 'rayon intervention', 'carte artisan', 'SEO local', 'cartographie'],
};

const googleFontsUrl = FONTS
  .filter((f) => f.googleParam)
  .map((f) => `family=${f.googleParam}`)
  .join('&');

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href={`https://fonts.googleapis.com/css2?${googleFontsUrl}&display=swap`}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
