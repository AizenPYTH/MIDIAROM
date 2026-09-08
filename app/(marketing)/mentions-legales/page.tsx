import type { Metadata } from "next";
import { SITE_URL } from "@/config/site";
import { LegalPage } from "@/components/marketing/legal-page";
import { getLegalDocument } from "@/lib/content";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Informations légales sur l'éditeur du site.",
  alternates: { canonical: `${SITE_URL}/mentions-legales` },
};

export default async function Page() {
  const document = await getLegalDocument("mentions-legales");
  return <LegalPage document={document} fallbackTitle="Mentions légales" />;
}
