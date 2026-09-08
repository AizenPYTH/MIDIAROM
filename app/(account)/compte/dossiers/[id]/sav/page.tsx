import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ROUTES } from "@/config/site";
import { Breadcrumbs, PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MediaGallery } from "@/components/customer/media-gallery";
import { MediaUploader } from "@/components/customer/media-uploader";
import { SavForm, SavReplyForm } from "@/components/customer/forms";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserOrRedirect } from "@/lib/security/auth";
import { signMedia } from "@/lib/media/service";
import { formatDateTime } from "@/lib/utils/format";
import { SAV_STATUS_LABELS } from "@/lib/orders/status";

export const metadata: Metadata = { title: "SAV", robots: { index: false } };


export default async function SavPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUserOrRedirect(`${ROUTES.accountOrders}/${id}/sav`);
  const supabase = await createSupabaseServerClient();
  const { data: order } = await supabase.from("repair_orders").select("id, order_number, status, model_name, repair_name").eq("id", id).maybeSingle();
  if (!order) notFound();
  const [{ data: requests }, { data: media }] = await Promise.all([
    supabase.from("sav_requests").select("*, messages:sav_messages(*)").eq("order_id", id).order("created_at", { ascending: false }),
    supabase.from("order_media").select("*").eq("order_id", id).eq("kind", "SAV").order("created_at", { ascending: false }),
  ]);
  const photos = await signMedia(media ?? []);
  const canOpen = ["DELIVERED", "COMPLETED", "SAV"].includes(order.status) && !(requests ?? []).some((r) => r.status !== "CLOSED");

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Mes dossiers", href: ROUTES.accountOrders }, { label: order.order_number, href: `${ROUTES.accountOrders}/${order.id}` }, { label: "SAV" }]} />
      <PageHeader title="Service après-vente" description={`${order.model_name} — ${order.repair_name}`} />

      {(requests ?? []).map((r) => (
        <Card key={r.id}>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>{r.subject}</CardTitle>
              <p className="text-xs text-ink-muted">Ouverte le {formatDateTime(r.created_at)}</p>
            </div>
            <Badge tone={r.status === "CLOSED" ? "neutral" : r.status === "ANSWERED" ? "success" : "warning"}>{SAV_STATUS_LABELS[r.status]}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="whitespace-pre-line text-sm text-ink">{r.description}</p>
            <ul className="space-y-2">
              {(r.messages as { id: string; body: string; is_from_staff: boolean; created_at: string }[])
                .sort((a, b) => a.created_at.localeCompare(b.created_at))
                .map((m) => (
                  <li key={m.id} className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.is_from_staff ? "bg-primary-soft" : "ml-auto bg-surface-muted"}`}>
                    <p className="whitespace-pre-line text-ink">{m.body}</p>
                    <p className="mt-1 text-[11px] text-ink-muted">
                      {m.is_from_staff ? "Atelier" : "Vous"} · {formatDateTime(m.created_at)}
                    </p>
                  </li>
                ))}
            </ul>
            {r.status !== "CLOSED" ? <SavReplyForm savId={r.id} orderId={order.id} /> : null}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Photos et vidéos</CardTitle>
          <p className="text-sm text-ink-muted">Ajoutez des preuves du problème : elles sont visibles uniquement par vous et l&apos;atelier.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <MediaGallery media={photos} emptyText="Aucun fichier joint." />
          {["DELIVERED", "COMPLETED", "SAV"].includes(order.status) ? <MediaUploader orderId={order.id} kind="SAV" /> : null}
        </CardContent>
      </Card>

      {canOpen ? (
        <Card>
          <CardHeader>
            <CardTitle>Nouvelle demande</CardTitle>
          </CardHeader>
          <CardContent>
            <SavForm orderId={order.id} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
