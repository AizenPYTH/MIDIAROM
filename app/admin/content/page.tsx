import Link from "next/link";
import { PageHeader } from "@/components/ui/misc";
import { requireAdminOrRedirect } from "@/lib/security/auth";

const ITEMS = [
  { href: "/admin/content/blocks", label: "Blocs de contenu", text: "Hero, réassurance, étapes, textes de confiance, CTA…" },
  { href: "/admin/content/faq", label: "FAQ", text: "Questions et réponses affichées sur le site." },
  { href: "/admin/content/packaging", label: "Instructions d'emballage", text: "Génériques et par modèle, avec illustrations." },
  { href: "/admin/content/gallery", label: "Galerie", text: "Photos de l'atelier, de l'équipe, avant/après." },
  { href: "/admin/content/legal", label: "Documents légaux", text: "CGV, confidentialité, mentions légales (versionnés)." },
  { href: "/admin/content/seo", label: "Pages SEO statiques", text: "Titles et descriptions des pages fixes." },
];

export default async function ContentHub() {
  await requireAdminOrRedirect();
  return (
    <div className="space-y-6">
      <PageHeader title="Contenu" description="Tout ce qui est affiché sur le site se modifie ici, sans redéploiement." />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map(({ href, label, text }, i) => (
          <li key={href}>
            <Link href={href} className="flex h-full gap-3 rounded-lg border border-border bg-surface p-4 hover:border-accent">
              <span className="shrink-0 font-mono text-[12px] text-accent-light">{String(i + 1).padStart(2, "0")}</span>
              <span><span className="block font-medium text-ink">{label}</span><span className="block text-sm text-ink-muted">{text}</span></span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
