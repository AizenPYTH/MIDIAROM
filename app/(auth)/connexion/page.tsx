import type { Metadata } from "next";
import { LoginForm } from "@/components/customer/auth-forms";

export const metadata: Metadata = { title: "Connexion", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return <LoginForm next={next} initialError={error === "lien-invalide" ? "Ce lien de connexion est invalide ou a expiré. Demandez-en un nouveau ci-dessous." : undefined} />;
}
