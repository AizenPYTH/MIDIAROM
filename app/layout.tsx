import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AnalyticsProvider } from "@/lib/analytics/client";
import { CartProvider } from "@/components/shop/cart-provider";
import { CookieBanner } from "@/components/marketing/cookie-banner";
import { SITE_URL } from "@/config/site";
import { getBrandSettings } from "@/lib/settings";

/**
 * Deux polices, deux rôles.
 *
 * **Archivo** porte les titres comme le corps : une grotesque étroite et
 * droite, qui tient les grands titres serrés du hero sans devenir décorative.
 * **IBM Plex Mono** marque ce qui se lit d'un coup d'œil — étiquettes, prix,
 * références, badges, HUD. C'est ce mono qui donne le registre atelier, et il
 * ne sert jamais à un paragraphe.
 */
const archivo = Archivo({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-archivo", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrandSettings();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `${brand.name} — ${brand.tagline}`, template: `%s | ${brand.name}` },
    description: brand.description,
    applicationName: brand.name,
    openGraph: { siteName: brand.name, locale: "fr_FR", type: "website" },
    twitter: { card: "summary_large_image" },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  return (
    <html lang="fr" className={`h-full ${archivo.variable} ${plexMono.variable}`}>
      <body className="flex min-h-full flex-col">
        <AnalyticsProvider gaId={gaId} adsId={adsId}>
          {/* Le panier vit dans le stockage local du visiteur : il doit
              envelopper tout le site public, pas seulement la boutique. */}
          <CartProvider>
            {children}
            <CookieBanner enabled={Boolean(gaId || adsId)} />
          </CartProvider>
        </AnalyticsProvider>
      </body>
    </html>
  );
}
