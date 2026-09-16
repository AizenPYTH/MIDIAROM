import type { Metadata, Viewport } from "next";
import { Geist_Mono, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";
import { AnalyticsProvider } from "@/lib/analytics/client";
import { CartProvider } from "@/components/shop/cart-provider";
import { CookieBanner } from "@/components/marketing/cookie-banner";
import { SITE_URL } from "@/config/site";
import { getBrandSettings } from "@/lib/settings";

/**
 * Deux polices, deux rôles.
 *
 * **Schibsted Grotesk** porte les titres comme le corps. Elle tient le H1 à
 * 92 px avec un interlettrage de −0,045em sans se casser, et reste lisible à
 * 15 px dans une fiche produit — c'est la condition d'un design dont le
 * spectaculaire vient de l'échelle et non des effets.
 * **Geist Mono** marque ce qui se lit d'un coup d'œil : étiquettes, prix,
 * références, états, numéros de section. Elle ne sert jamais à un paragraphe.
 *
 * Les graisses sont déclarées jusqu'à 800 : le handoff s'en sert pour les
 * titres. En demander moins ferait synthétiser le gras par le navigateur.
 */
const grotesk = Schibsted_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-display-face", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono-face", display: "swap" });

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
  themeColor: "#f5f5f6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  return (
    <html lang="fr" className={`h-full ${grotesk.variable} ${mono.variable}`}>
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
