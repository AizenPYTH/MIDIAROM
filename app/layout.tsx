import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { AnalyticsProvider } from "@/lib/analytics/client";
import { CookieBanner } from "@/components/marketing/cookie-banner";
import { SITE_URL } from "@/config/site";
import { getBrandSettings } from "@/lib/settings";

/**
 * Les trois polices de la charte v4 : Bricolage Grotesque pour les titres (axe
 * optique variable), Instrument Sans pour le texte, DM Mono pour les étiquettes,
 * les prix et les compteurs.
 */
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-bricolage", display: "swap" });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-instrument", display: "swap" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono", display: "swap" });

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
  themeColor: "#07060a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  return (
    <html lang="fr" className={`h-full ${bricolage.variable} ${instrument.variable} ${dmMono.variable}`}>
      <body className="flex min-h-full flex-col">
        <AnalyticsProvider gaId={gaId} adsId={adsId}>
          {children}
          <CookieBanner enabled={Boolean(gaId || adsId)} />
        </AnalyticsProvider>
      </body>
    </html>
  );
}
