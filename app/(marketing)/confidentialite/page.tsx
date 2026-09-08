import type { Metadata } from "next";
import { SITE_URL } from "@/config/site";
import { LegalPage } from "@/components/marketing/legal-page";
import { getLegalDocument } from "@/lib/content";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Données collectées, finalités, durée de conservation et vos droits.",
  alternates: { canonical: `${SITE_URL}/confidentialite` },
};

export default async function Page() {
  const document = await getLegalDocument("confidentialite");
  return <LegalPage document={document} fallbackTitle="Politique de confidentialité" />;
}
