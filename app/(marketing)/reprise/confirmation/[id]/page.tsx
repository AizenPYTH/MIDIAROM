import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ROUTES } from "@/config/site";
import { Container, Eyebrow } from "@/components/ui/misc";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Demande de reprise envoyée", robots: { index: false, follow: false } };

export default async function TradeInConfirmationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  const [{ id }, { token }] = await Promise.all([params, searchParams]);
  if (!token) notFound();
  const { data: t } = await createSupabaseAdminClient().from("trade_in_requests").select("*").eq("id", id).eq("access_token", token).maybeSingle();
  if (!t) notFound();
  return (
    <Container className="max-w-[760px] py-16">
      <Eyebrow>Reprise</Eyebrow>
      <h1 className="mt-2 text-[clamp(28px,3.4vw,42px)] font-extrabold leading-[1.02] tracking-[-0.02em] text-ink">Merci, votre demande est envoyée.</h1>
      <p className="mt-3 text-[16.5px] text-ink-soft">Votre numéro de demande :</p>
      <p className="mt-1 font-mono text-[34px] font-semibold tracking-[-0.02em] text-ink">{t.request_number}</p>
      <p className="mt-3 text-[14px] text-ink-muted">L&apos;atelier examine « {t.item_title} » et vous envoie une offre à {t.customer_email}. Vous pourrez l&apos;accepter ou la refuser en ligne.</p>
      <div className="mt-6 flex flex-wrap gap-2.5">
        <Link href={`${ROUTES.tradeInTracking}/${t.access_token}`} className="bg-ink-900 px-[22px] py-3.5 text-[15px] font-semibold text-paper hover:bg-sale">
          Suivre ma demande
        </Link>
        <Link href={ROUTES.shop} className="border border-ink px-[22px] py-3.5 text-[15px] font-semibold text-ink hover:bg-ink hover:text-paper">
          Voir la boutique
        </Link>
      </div>
    </Container>
  );
}
