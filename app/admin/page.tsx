import Link from "next/link";
import { requireStaffOrRedirect } from "@/lib/security/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CATEGORY_SLUGS } from "@/lib/shop/status";

/**
 * L'accueil du back-office.
 *
 * Il n'existait pas : `/admin` ouvrait directement la file de l'atelier, et
 * tout le reste — mettre une console en vente, importer une figurine, changer
 * un tarif — vivait dans un menu « Plus » qui, faute d'onglets à sa gauche,
 * s'ouvrait hors de l'écran. On pouvait tenir le site sans jamais trouver
 * l'import de figurines.
 *
 * Cette page répond donc à une seule question : **qu'est-ce que vous voulez
 * faire ?** Quatre façons de publier une annonce en haut, parce que c'est le
 * geste le plus fréquent et le plus mal desservi ; ce qui attend en dessous ;
 * et l'index complet en bas, visible, sans rien de replié.
 *
 * Aucun chiffre n'est calculé ici sans être lu en base : un compteur qui ment
 * est pire qu'un compteur absent.
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "Back-office" };

/** Une grande carte d'action. Le geste d'abord, l'explication ensuite. */
function Action({ href, title, note, tone = "ink" }: { href: string; title: string; note: string; tone?: "ink" | "red" }) {
  return (
    <Link
      href={href}
      data-card="1"
      className="flex min-w-0 flex-col gap-2 border border-border bg-surface p-5 transition-colors hover:border-ink"
    >
      <span className={`font-mono text-[10.5px] uppercase tracking-[0.12em] ${tone === "red" ? "text-red" : "text-ink-muted"}`}>
        Publier
      </span>
      <strong className="text-[19px] font-bold leading-[1.15] tracking-[-0.02em] text-ink">{title}</strong>
      <span className="text-[14px] leading-[1.45] text-ink-soft">{note}</span>
      <span aria-hidden="true" className="mt-1 font-mono text-[13px] text-ink-muted">
        →
      </span>
    </Link>
  );
}

/** Une ligne de travail en attente : ce qu'il y a à faire, et combien. */
function File({ href, label, count, note }: { href: string; label: string; count: number; note: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 border-t border-border-hairline py-3.5 text-ink transition-colors hover:text-red"
      data-row="1"
    >
      <span className="min-w-0">
        <strong className="text-[15.5px] font-semibold">{label}</strong>
        <span className="mt-0.5 block text-[13.5px] text-ink-soft">{note}</span>
      </span>
      <span className="flex shrink-0 items-center gap-3">
        <span className={`font-mono text-[15px] ${count > 0 ? "text-ink" : "text-ink-muted"}`}>{count}</span>
        <span aria-hidden="true" data-arrow="1" className="text-[15px] text-ink-muted">
          →
        </span>
      </span>
    </Link>
  );
}

/** Le reste du back-office, en clair. Rien n'est caché derrière un menu. */
const INDEX: { titre: string; liens: { href: string; label: string; note: string }[] }[] = [
  {
    titre: "Boutique",
    liens: [
      { href: "/admin/annonces/nouvelle", label: "Nouvelle annonce", note: "Le formulaire court : six champs" },
      { href: "/admin/stock", label: "Tous les articles", note: "Prix, stock, photos, mise en ligne" },
      { href: "/admin/shop-orders", label: "Commandes boutique", note: "À préparer, expédiées, retirées" },
      { href: "/admin/catalog/figurines", label: "Importer une figurine", note: "Recherche HobbyLink Japan, création en brouillon" },
      { href: "/admin/trade-ins", label: "Reprises", note: "Offres à faire, consoles reçues" },
    ],
  },
  {
    titre: "Atelier",
    liens: [
      { href: "/admin/atelier", label: "File de réparation", note: "Diagnostic, devis, atelier, retour" },
      { href: "/admin/reception", label: "Réception", note: "Colis attendus et arrivés" },
      { href: "/admin/orders", label: "Tous les dossiers", note: "Historique complet" },
      { href: "/admin/sav", label: "SAV", note: "Retours sous garantie" },
    ],
  },
  {
    titre: "Tarifs de réparation",
    liens: [
      { href: "/admin/catalog/brands", label: "Marques", note: "Sony, Nintendo, Microsoft…" },
      { href: "/admin/catalog/models", label: "Consoles", note: "Les modèles réparables et leurs pages" },
      { href: "/admin/catalog/faults", label: "Pannes", note: "Les symptômes proposés au client" },
      { href: "/admin/catalog/repairs", label: "Prestations et prix", note: "Ce qui est facturé, par console et par panne" },
    ],
  },
  {
    titre: "Le site",
    liens: [
      { href: "/admin/content", label: "Textes et pages", note: "Accueil, FAQ, mentions, galerie" },
      { href: "/admin/settings", label: "Réglages", note: "Nom, adresse, horaires, garantie, livraison" },
      { href: "/admin/reviews", label: "Avis clients", note: "À publier ou masquer" },
      { href: "/admin/customers", label: "Clients", note: "Fiches et historique" },
    ],
  },
  {
    titre: "Gestion",
    liens: [
      { href: "/admin/options", label: "Options et packs", note: "Suppléments proposés au devis" },
      { href: "/admin/shipping", label: "Transport", note: "Transporteurs et tarifs" },
      { href: "/admin/technicians", label: "Techniciens", note: "Qui travaille sur quoi" },
      { href: "/admin/analytics", label: "Statistiques", note: "Chiffre d'affaires, marges, coûts" },
    ],
  },
];

export default async function AdminHomePage() {
  const user = await requireStaffOrRedirect();
  const db = createSupabaseAdminClient();

  /**
   * `head: true` ne ramène que le total : on n'a pas besoin des lignes pour
   * afficher un nombre. Et une base injoignable rend zéro plutôt que de faire
   * tomber la page — l'accueil du back-office doit toujours s'ouvrir.
   */
  const total = async (p: PromiseLike<{ count: number | null }>) => {
    try {
      return (await p).count ?? 0;
    } catch {
      return 0;
    }
  };

  const OUVERTS = ["PAID", "AWAITING_SHIPMENT", "IN_TRANSIT_TO_WORKSHOP", "RECEIVED", "RECEPTION_CHECK", "DIAGNOSIS", "WAITING_CUSTOMER_APPROVAL", "APPROVED", "REPAIRING", "QUALITY_CONTROL", "READY_TO_SHIP", "RETURN_REQUIRED", "SAV", "DISPUTED"] as const;

  const [reparations, commandes, reprises, brouillons] = await Promise.all([
    total(db.from("repair_orders").select("id", { count: "exact", head: true }).in("status", [...OUVERTS])),
    total(db.from("shop_orders").select("id", { count: "exact", head: true }).in("status", ["PAID", "PREPARED"])),
    total(db.from("trade_in_requests").select("id", { count: "exact", head: true }).eq("status", "NEW")),
    total(db.from("products").select("id", { count: "exact", head: true }).eq("is_active", false)),
  ]);

  const prenom = user.profile.first_name?.trim();

  return (
    <div className="mx-auto w-full max-w-[1420px] px-4 py-7 sm:px-[30px]">
      <h1 className="text-[clamp(24px,3vw,34px)] font-bold tracking-[-0.03em] text-ink">
        {prenom ? `Bonjour ${prenom}.` : "Back-office"}
      </h1>
      <p className="mt-2 max-w-[60ch] text-[15.5px] leading-[1.5] text-ink-soft">
        Qu&apos;est-ce que vous voulez faire&#8239;?
      </p>

      {/* ── Publier, en premier : c'est le geste le plus fréquent ───────── */}
      <h2 className="mt-8 font-mono text-[11.5px] uppercase tracking-[0.14em] text-red">Mettre en vente</h2>
      <div className="mt-4 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <Action
          href={`/admin/annonces/nouvelle?cat=${CATEGORY_SLUGS.GAME}`}
          title="Un jeu vidéo"
          note="Six champs. La jaquette et le résumé se récupèrent ensuite depuis IGDB, sur la fiche."
          tone="red"
        />
        <Action href={`/admin/annonces/nouvelle?cat=${CATEGORY_SLUGS.CONSOLE}`} title="Une console" note="Six champs : nom, plateforme, état, prix, quantité. Le reste est déduit." />
        <Action
          href="/admin/catalog/figurines"
          title="Une figurine"
          note="Cherchez-la chez HobbyLink Japan : la fiche est créée en brouillon, prête à compléter."
          tone="red"
        />
        <Action href="/admin/catalog/repairs/new" title="Une réparation" note="Une prestation facturable : console, panne, prix et délai." />
      </div>

      {/* ── Ce qui attend ───────────────────────────────────────────────── */}
      <h2 className="mt-10 font-mono text-[11.5px] uppercase tracking-[0.14em] text-ink-muted">Ce qui vous attend</h2>
      <div className="mt-3 border-b border-border-hairline">
        <File href="/admin/atelier" label="Réparations en cours" count={reparations} note="Dossiers ouverts, du diagnostic au retour" />
        <File href="/admin/shop-orders" label="Commandes à préparer" count={commandes} note="Payées, pas encore expédiées ni retirées" />
        <File href="/admin/trade-ins" label="Reprises à évaluer" count={reprises} note="Demandes reçues, en attente d'une offre" />
        <File href="/admin/stock?f=inactive" label="Articles en brouillon" count={brouillons} note="Créés mais pas encore en ligne" />
      </div>

      {/* ── L'index, en clair ───────────────────────────────────────────── */}
      <h2 className="mt-10 font-mono text-[11.5px] uppercase tracking-[0.14em] text-ink-muted">Tout le back-office</h2>
      <div className="mt-4 grid gap-x-8 gap-y-7" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {INDEX.map((groupe) => (
          <section key={groupe.titre} className="min-w-0">
            <h3 className="text-[15.5px] font-semibold tracking-[-0.01em] text-ink">{groupe.titre}</h3>
            <ul className="mt-2 flex list-none flex-col p-0">
              {groupe.liens.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="block border-t border-border-hairline py-2.5 transition-colors hover:text-red">
                    <span className="text-[14.5px] text-ink">{l.label}</span>
                    <span className="mt-0.5 block text-[13px] leading-[1.4] text-ink-muted">{l.note}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
