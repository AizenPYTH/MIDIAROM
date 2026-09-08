import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container, PageHeader } from "@/components/ui/misc";
import { Alert } from "@/components/ui/alert";
import { ReviewForm } from "@/components/customer/forms";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Votre avis", robots: { index: false, follow: false } };

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{36}$/.test(token)) notFound();
  const { data: review } = await createSupabaseAdminClient().from("reviews").select("id, submitted_at, order:repair_orders(model_name, repair_name, customer_first_name)").eq("review_token", token).maybeSingle();
  if (!review) notFound();
  const order = review.order as { model_name: string; repair_name: string; customer_first_name: string } | null;
  return (
    <Container className="max-w-lg py-10 sm:py-16">
      <PageHeader eyebrow="Votre avis" title={`Merci ${order?.customer_first_name ?? ""} !`} description={`Comment s'est passée la réparation de votre ${order?.model_name ?? "console"} (${order?.repair_name ?? ""}) ?`} />
      <div className="mt-8 rounded-lg border border-border bg-surface p-6">
        {review.submitted_at ? <Alert tone="success">Vous avez déjà déposé un avis pour ce dossier. Merci !</Alert> : <ReviewForm token={token} />}
      </div>
      <p className="mt-4 text-xs text-ink-muted">Les avis sont liés à une réparation réelle et publiés après modération. Nous ne publions jamais d&apos;avis fictifs.</p>
    </Container>
  );
}
