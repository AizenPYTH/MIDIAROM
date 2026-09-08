import type { Metadata } from "next";
import { SITE_URL } from "@/config/site";
import { LegalPage } from "@/components/marketing/legal-page";
import { getLegalDocument } from "@/lib/content";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Conditions générales de vente",
  description: "Conditions applicables aux commandes de réparation : prix, paiement, diagnostic, devis, transport, garantie.",
  alternates: { canonical: `${SITE_URL}/cgv` },
};

export default async function Page() {
  const document = await getLegalDocument("cgv");
  return <LegalPage document={document} fallbackTitle="Conditions générales de vente" />;
}
