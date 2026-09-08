import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/admin/ui";
import { MediaGallery } from "@/components/customer/media-gallery";
import { SavUpdateForm } from "@/components/admin/settings-forms";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStaffOrRedirect } from "@/lib/security/auth";
import { signMedia } from "@/lib/media/service";
import { SAV_STATUS_LABELS } from "@/lib/orders/status";
import { formatDateTime } from "@/lib/utils/format";

export default async function SavDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaffOrRedirect();
  const db = createSupabaseAdminClient();
  const { data: sav } = await db.from("sav_requests").select("*, order:repair_orders(id, order_number, model_name, repair_name, customer_first_name, customer_last_name, customer_email, warranty_months, delivered_at), messages:sav_messages(*, author:profiles(first_name, last_name))").eq("id", id).maybeSingle();
  if (!sav) notFound();
  const order = sav.order as { id: string; order_number: string; model_name: string; repair_name: string; customer_first_name: string; customer_last_name: string; customer_email: string; warranty_months: number; delivered_at: string | null };
  const { data: media } = await db.from("order_media").select("*").eq("order_id", order.id).eq("kind", "SAV").order("created_at", { ascending: false });
  const photos = await signMedia(media ?? []);
  const messages = (sav.messages as { id: string; body: string; is_from_staff: boolean; is_internal: boolean; created_at: string; author: { first_name: string | null; last_name: string | null } | null }[]).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const warrantyEnd = order.delivered_at && order.warranty_months ? new Date(new Date(order.delivered_at).setMonth(new Date(order.delivered_at).getMonth() + order.warranty_months)) : null;
  return (
    <div className="space-y-6">
      <Link href="/admin/sav" className="text-xs text-ink-muted hover:text-ink">← SAV</Link>
      <PageHeader title={sav.subject} description={`${order.customer_first_name} ${order.customer_last_name} · ${order.customer_email}`} actions={<Badge tone={sav.status === "CLOSED" ? "neutral" : "warning"} className="text-sm">{SAV_STATUS_LABELS[sav.status]}</Badge>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Dossier concerné">
          <p className="text-sm"><Link href={`/admin/orders/${order.id}`} className="font-mono text-accent hover:underline">{order.order_number}</Link> · {order.model_name} — {order.repair_name}</p>
          <p className="mt-1 text-sm text-ink-soft">Livré le {formatDateTime(order.delivered_at)} · garantie {order.warranty_months} mois{warrantyEnd ? ` (jusqu'au ${formatDateTime(warrantyEnd)})` : ""}</p>
          <p className="mt-3 whitespace-pre-line text-sm text-ink">{sav.description}</p>
          <div className="mt-4"><MediaGallery media={photos} emptyText="Aucune pièce jointe du client." /></div>
        </Section>
        <Section title="Traitement"><SavUpdateForm savId={sav.id} status={sav.status} /></Section>
      </div>
      <Section title="Échanges">
        <ul className="space-y-2">
          {messages.map((m) => <li key={m.id} className={`rounded-md px-3 py-2 text-sm ${m.is_internal ? "border border-dashed border-warning/50 bg-warning-soft" : m.is_from_staff ? "bg-primary-soft" : "bg-surface-muted"}`}><p className="whitespace-pre-line">{m.body}</p><p className="mt-1 text-[11px] text-ink-muted">{m.is_internal ? "Interne · " : m.is_from_staff ? "Atelier · " : "Client · "}{m.author ? `${m.author.first_name ?? ""} ${m.author.last_name ?? ""} · ` : ""}{formatDateTime(m.created_at)}</p></li>)}
          {!messages.length ? <li className="text-sm text-ink-muted">Aucun message.</li> : null}
        </ul>
      </Section>
    </div>
  );
}
