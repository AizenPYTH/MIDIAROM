import type { Metadata } from "next";
import { LoginForm } from "@/components/customer/auth-forms";

export const metadata: Metadata = { title: "Connexion", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const messages: Record<string, string> = {
    "lien-invalide": "Ce lien de connexion est invalide ou a expiré. Demandez-en un nouveau ci-dessous.",
    "profil-incomplet": "Votre compte est authentifié mais son profil est introuvable dans la base. Reconnectez-vous ; si le message persiste, contactez-nous.",
  };
  return <LoginForm next={next} initialError={error ? messages[error] : undefined} />;
}
