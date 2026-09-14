import type { Metadata } from "next";
import { Eyebrow } from "@/components/ui/misc";
import { ShopCheckoutForm } from "@/components/shop/checkout-form";
import { getCurrentUser } from "@/lib/security/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getLegalDocument } from "@/lib/content";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Commande", robots: { index: false, follow: false } };

export default async function ShopCheckoutPage({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const [{ cancelled }, user, cgv] = await Promise.all([searchParams, getCurrentUser(), getLegalDocument("cgv")]);
  let defaultAddress = null;
  if (user) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from("addresses").select("*").eq("profile_id", user.id).order("is_default", { ascending: false }).limit(1).maybeSingle();
    defaultAddress = data;
  }
  return (
    <section className="bg-ink-900 px-6 py-[56px] text-paper">
      <div className="mx-auto max-w-[1280px]">
        <Eyebrow>Boutique</Eyebrow>
        <h1 className="mb-8 mt-2 text-[clamp(28px,3.4vw,42px)] font-extrabold leading-[1.02] tracking-[-0.02em]">Finaliser ma commande</h1>
        <ShopCheckoutForm
          initialCustomer={user ? { first_name: user.profile.first_name ?? "", last_name: user.profile.last_name ?? "", email: user.email, phone: user.profile.phone ?? "" } : null}
          initialAddress={defaultAddress ? { line1: defaultAddress.line1, line2: defaultAddress.line2 ?? "", postal_code: defaultAddress.postal_code, city: defaultAddress.city } : null}
          isLoggedIn={Boolean(user)}
          cgvVersion={cgv?.version ?? null}
          cancelled={cancelled === "1"}
        />
      </div>
    </section>
  );
}
