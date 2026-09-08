import Link from "next/link";
import { EntityListPage } from "@/components/admin/entity-pages";

export default function Page() {
  return (
    <EntityListPage
      entityKey="repair_options"
      description="Prestations additionnelles proposées au checkout et dans les devis. La compatibilité se règle sur chaque option."
      extra={<p className="text-sm"><Link href="/admin/options/categories" className="text-accent hover:underline">Gérer les catégories d&apos;options</Link></p>}
    />
  );
}
