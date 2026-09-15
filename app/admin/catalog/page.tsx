import Link from "next/link";
import { PageHeader } from "@/components/ui/misc";
import { StatCard } from "@/components/admin/ui";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrRedirect } from "@/lib/security/auth";

export default async function CatalogHub() {
  await requireAdminOrRedirect();
  const db = createSupabaseAdminClient();
  const c = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);
  const [brands, models, faults, repairs, seo] = await Promise.all([
    c(db.from("brands").select("id", { count: "exact", head: true })),
    c(db.from("console_models").select("id", { count: "exact", head: true })),
    c(db.from("faults").select("id", { count: "exact", head: true })),
    c(db.from("repairs").select("id", { count: "exact", head: true }).eq("is_active", true)),
    c(db.from("repairs").select("id", { count: "exact", head: true }).eq("is_seo_published", true)),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Catalogue" description="Consoles, modèles, pannes et prestations. Chaque combinaison modèle × panne publiée génère une page SEO." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Marques" value={brands} href="/admin/catalog/brands" />
        <StatCard label="Modèles" value={models} href="/admin/catalog/models" />
        <StatCard label="Pannes" value={faults} href="/admin/catalog/faults" />
        <StatCard label="Réparations actives" value={repairs} hint={`${seo} pages SEO publiées`} href="/admin/catalog/repairs" />
      </div>
      <p className="text-sm text-ink-muted">
        Ordre conseillé : <Link href="/admin/catalog/brands" className="text-accent">marques</Link> → <Link href="/admin/catalog/models" className="text-accent">modèles</Link> → <Link href="/admin/catalog/faults" className="text-accent">pannes</Link> → <Link href="/admin/catalog/repairs" className="text-accent">réparations</Link> → <Link href="/admin/options" className="text-accent">options</Link> → <Link href="/admin/packs" className="text-accent">packs</Link>.
      </p>
    </div>
  );
}
