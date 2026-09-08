import Link from "next/link";
import { FileText, HelpCircle, Image, Package, Scale, Search, LayoutTemplate } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { requireAdminOrRedirect } from "@/lib/security/auth";

const ITEMS = [
  { href: "/admin/content/blocks", label: "Blocs de contenu", text: "Hero, réassurance, étapes, textes de confiance, CTA…", Icon: LayoutTemplate },
  { href: "/admin/content/faq", label: "FAQ", text: "Questions et réponses affichées sur le site.", Icon: HelpCircle },
  { href: "/admin/content/packaging", label: "Instructions d'emballage", text: "Génériques et par modèle, avec illustrations.", Icon: Package },
  { href: "/admin/content/gallery", label: "Galerie", text: "Photos de l'atelier, de l'équipe, avant/après.", Icon: Image },
  { href: "/admin/content/legal", label: "Documents légaux", text: "CGV, confidentialité, mentions légales (versionnés).", Icon: Scale },
  { href: "/admin/content/seo", label: "Pages SEO statiques", text: "Titles et descriptions des pages fixes.", Icon: Search },
];

export default async function ContentHub() {
  await requireAdminOrRedirect();
  return (
    <div className="space-y-6">
      <PageHeader title="Contenu" description="Tout ce qui est affiché sur le site se modifie ici, sans redéploiement." />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map(({ href, label, text, Icon }) => (
          <li key={href}>
            <Link href={href} className="flex h-full gap-3 rounded-lg border border-border bg-surface p-4 hover:border-accent">
              <Icon className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
              <span><span className="block font-medium text-ink">{label}</span><span className="block text-sm text-ink-muted">{text}</span></span>
            </Link>
          </li>
        ))}
      </ul>
      <span className="hidden"><FileText /></span>
    </div>
  );
}
