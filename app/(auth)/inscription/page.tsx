import type { Metadata } from "next";
import { RegisterForm } from "@/components/customer/auth-forms";

export const metadata: Metadata = { title: "Créer un compte", robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <RegisterForm next={next} />;
}
