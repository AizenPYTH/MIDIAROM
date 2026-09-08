import Link from "next/link";
import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/admin/ui";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrRedirect } from "@/lib/security/auth";
import { moderateReviewAction } from "@/app/admin/actions/admin";
import { formatDateTime } from "@/lib/utils/format";

export default async function ReviewsPage() {
  await requireAdminOrRedirect();
  const { data: reviews } = await createSupabaseAdminClient().from("reviews").select("*, order:repair_orders(order_number, model_name, repair_name)").not("submitted_at", "is", null).order("submitted_at", { ascending: false }).limit(200);
  const { count: pendingRequests } = await createSupabaseAdminClient().from("reviews").select("id", { count: "exact", head: true }).is("submitted_at", null);
  return (
    <div className="space-y-6">
      <PageHeader title="Avis clients" description={`Avis authentiques liés à un dossier. Seuls les avis approuvés sont affichés sur le site. ${pendingRequests ?? 0} demande(s) d'avis envoyée(s) sans réponse.`} />
      <Table>
        <thead><tr><Th>Dossier</Th><Th>Note</Th><Th>Avis</Th><Th>Statut</Th><Th>Date</Th><Th></Th></tr></thead>
        <tbody>
          {(reviews ?? []).map((r) => {
            const order = r.order as { order_number: string; model_name: string; repair_name: string } | null;
            return (
              <tr key={r.id}>
                <Td><Link href={`/admin/orders/${r.order_id}`} className="font-mono text-accent hover:underline">{order?.order_number}</Link><span className="block text-xs text-ink-muted">{order?.model_name} — {order?.repair_name}</span></Td>
                <Td>{"★".repeat(r.rating ?? 0)}<span className="text-ink-muted">{"★".repeat(5 - (r.rating ?? 0))}</span></Td>
                <Td className="max-w-md"><span className="font-medium">{r.title}</span><span className="block text-ink-soft">{r.body}</span><span className="block text-xs text-ink-muted">{r.display_name ?? "Anonyme"}</span></Td>
                <Td><Badge tone={r.status === "APPROVED" ? "success" : r.status === "REJECTED" ? "danger" : "warning"}>{r.status}</Badge>{r.is_featured ? <Badge tone="primary" className="ml-1">À la une</Badge> : null}</Td>
                <Td className="text-ink-muted">{formatDateTime(r.submitted_at)}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {(["approve", "reject", r.is_featured ? "unfeature" : "feature"] as const).map((d) => (
                      <form key={d} action={moderateReviewAction}><input type="hidden" name="review_id" value={r.id} /><input type="hidden" name="decision" value={d} /><Button type="submit" size="sm" variant={d === "reject" ? "ghost" : "outline"} className="h-7 px-2 text-xs">{{ approve: "Approuver", reject: "Rejeter", feature: "Mettre en avant", unfeature: "Retirer de la une" }[d]}</Button></form>
                    ))}
                  </div>
                </Td>
              </tr>
            );
          })}
          {!reviews?.length ? <tr><Td colSpan={6} className="text-center text-ink-muted">Aucun avis déposé pour le moment.</Td></tr> : null}
        </tbody>
      </Table>
    </div>
  );
}
