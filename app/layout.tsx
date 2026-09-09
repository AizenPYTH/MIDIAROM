import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AnalyticsProvider } from "@/lib/analytics/client";
import { CookieBanner } from "@/components/marketing/cookie-banner";
import { CartProvider } from "@/components/shop/cart-provider";
import { SITE_URL } from "@/config/site";
import { getBrandSettings } from "@/lib/settings";

const archivo = Archivo({ subsets: ["latin"], weight: ["400", "500", "600", "800"], variable: "--font-archivo", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-mono", display: "swap" });

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
  themeColor: "#14120f",
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
          <CartProvider>
            {children}
            <CookieBanner enabled={Boolean(gaId || adsId)} />
          </CartProvider>
        </AnalyticsProvider>
      </body>
    </html>
  );
}
