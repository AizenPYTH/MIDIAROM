import Link from "next/link";
import { requireStaffOrRedirect } from "@/lib/security/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CATEGORY_SLUGS } from "@/lib/shop/status";
import { depuis, EN_COURS, joursDepuis, ORDRE, REGISTRES, registreOf, type Registre } from "@/lib/admin/workbench";
import { formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * Le back-office : ce qui attend une action.
 *
 * L'écran répond à une seule question, et la liste des réparations **est** la
 * page. Le réparateur l'ouvre vingt fois par jour pour suivre des dossiers, pas
 * pour publier un article : l'ajout au catalogue tient donc en quatre boutons
 * en bas de la colonne de droite.
 *
 * **Le rouge ne signale qu'une chose : ce qui dépend du client.** Le compteur
 * des devis en attente, l'état « Devis envoyé », les puces de relance en
 * retard, les commandes à expédier. Nulle part ailleurs — sinon il ne signale
 * plus rien.
 *
 * Aucun indicateur n'est inventé : chaque nombre est compté en base, et un
 * bloc sans donnée le dit plutôt que d'afficher un tiret.
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "Back-office" };

/** Ce que porte une ligne de réparation, une fois le statut traduit. */
interface Ligne {
  id: string;
  ref: string;
  client: string;
  console: string;
  panne: string;
  prix: string;
  registre: Registre;
  /** Depuis combien de jours le devis attend. Null hors registre « attente ». */
  attendDepuis: number | null;
}

/** Le traitement visuel d'un état. Trois registres, trois lectures. */
const PASTILLE: Record<Registre, string> = {
  // La balle est chez le client : le seul rouge de la liste.
  attente: "border-[#f3c9cb] bg-[#fdecec] text-[#a8161c]",
  atelier: "border-ink bg-ink text-white",
  diag: "border-border-strong bg-surface text-ink",
  prete: "border-border bg-surface-strong text-ink-muted",
};

function Pastille({ registre }: { registre: Registre }) {
  return (
    <span className={cn("inline-block border px-[9px] py-[5px] font-mono text-[10.5px] uppercase tracking-[0.07em]", PASTILLE[registre])}>
      {registre === "attente" ? "Devis envoyé" : registre === "prete" ? "Prête" : REGISTRES[registre].label}
    </span>
  );
}

const CELL = "px-[22px] py-[15px]";
const PANNEAU = "border border-border bg-surface p-5";

/** Les quatre raccourcis de publication. Action rare, donc en bas de colonne. */
const AJOUTS = [
  { label: "Un jeu vidéo", href: `/admin/annonces/nouvelle?cat=${CATEGORY_SLUGS.GAME}` },
  { label: "Une console", href: `/admin/annonces/nouvelle?cat=${CATEGORY_SLUGS.CONSOLE}` },
  { label: "Une figurine", href: "/admin/catalog/figurines" },
  { label: "Une prestation", href: "/admin/catalog/repairs/new" },
];

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  await requireStaffOrRedirect();
  const { f } = await searchParams;
  const onglet = ORDRE.includes(f as Registre) ? (f as Registre) : null;
  const db = createSupabaseAdminClient();

  const { data } = await db
    .from("repair_orders")
    .select("id, order_number, model_name, fault_name, repair_name, status, total_cents, customer_first_name, customer_last_name, created_at, updated_at")
    .in("status", EN_COURS)
    .order("created_at", { ascending: false })
    .limit(200);

  const toutes: Ligne[] = (data ?? []).flatMap((o) => {
    const registre = registreOf(o.status);
    if (!registre) return [];
    const nom = [o.customer_first_name, o.customer_last_name].filter(Boolean).join(" ").trim();
    return [
      {
        id: o.id,
        ref: o.order_number,
        client: nom || "Client sans nom",
        console: o.model_name ?? "Console non précisée",
        panne: o.fault_name ?? o.repair_name ?? "Panne à qualifier",
        // Pas encore chiffré : un tiret, jamais un zéro qui passerait pour gratuit.
        prix: o.total_cents ? formatPrice(o.total_cents) : "—",
        registre,
        // `updated_at` est la dernière écriture du dossier : pour un devis en
        // attente, c'est l'envoi. Faute d'horodatage dédié, c'est la meilleure
        // approximation disponible, et elle ne sert qu'à trier les relances.
        attendDepuis: registre === "attente" ? joursDepuis(o.updated_at ?? o.created_at) : null,
      },
    ];
  });

  const parRegistre = (r: Registre) => toutes.filter((l) => l.registre === r);
  const lignes = onglet ? parRegistre(onglet) : toutes;

  // Commandes boutique récentes, pour la colonne de droite.
  const { data: commandes } = await db
    .from("shop_orders")
    .select("id, order_number, status, fulfillment, total_cents")
    .in("status", ["PAID", "PREPARED", "SHIPPED"])
    .order("created_at", { ascending: false })
    .limit(4);

  /**
   * « À faire maintenant », déduit de la liste et non saisi à la main.
   *
   * Les relances les plus anciennes d'abord — ce sont elles qui bloquent le
   * chiffre d'affaires —, puis les colis à préparer, puis les consoles à
   * ouvrir. Un dossier qui n'appelle aucune action n'y figure pas.
   */
  const relances = parRegistre("attente")
    .filter((l) => (l.attendDepuis ?? 0) >= 2)
    .sort((a, b) => (b.attendDepuis ?? 0) - (a.attendDepuis ?? 0))
    .slice(0, 3)
    .map((l) => ({
      id: l.id,
      label: `Relancer ${l.client} — devis envoyé ${depuis(l.attendDepuis)}`,
      meta: `${l.ref} · ${l.prix}`,
      urgent: true,
    }));

  const colis = parRegistre("prete")
    .slice(0, 2)
    .map((l) => ({ id: l.id, label: `Préparer le colis retour de ${l.client}`, meta: `${l.ref} · ${l.console}`, urgent: false }));

  const aOuvrir = parRegistre("diag");
  const diagnostics = aOuvrir.length
    ? [
        {
          id: "diag",
          label: aOuvrir.length === 1 ? "Diagnostiquer la console reçue" : `Diagnostiquer les ${aOuvrir.length} consoles reçues`,
          meta: aOuvrir.slice(0, 3).map((l) => l.ref).join(", "),
          urgent: false,
        },
      ]
    : [];

  const aFaire = [...relances, ...colis, ...diagnostics];

  return (
    <div className="w-full page-wrap px-[22px] pb-14 pt-[26px]">
      {/* ── Ligne d'état : quatre nombres, rien de plus ──────────────────── */}
      <div className="mb-[26px] grid gap-px border border-border bg-border" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
        {ORDRE.map((r) => {
          const n = parRegistre(r).length;
          return (
            <Link key={r} href={`/admin?f=${r}`} className="flex flex-col gap-1.5 bg-surface p-5 transition-colors hover:bg-surface-muted">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">{REGISTRES[r].label}</span>
              {/* Un seul compteur en rouge : celui qui bloque le chiffre d'affaires. */}
              <span className={cn("text-[34px] font-bold leading-none tracking-[-0.035em]", r === "attente" && n > 0 ? "text-red" : "text-ink")}>{n}</span>
              <span className="text-[13.5px] text-ink-muted">{REGISTRES[r].note}</span>
            </Link>
          );
        })}
      </div>

      <div data-split="1">
        {/* ══ colonne principale : les réparations ══ */}
        <section id="liste" className="min-w-0 border border-border bg-surface">
          <div className="flex flex-wrap items-end justify-between gap-4 px-[22px] pt-5">
            <h1 className="text-[23px] font-bold tracking-[-0.028em] text-ink">Réparations en cours</h1>
            <Link
              href="/admin/reception"
              className="bg-red px-[18px] py-3 text-[14.5px] font-semibold text-white transition-colors hover:bg-ink"
            >
              Nouvelle réparation
            </Link>
          </div>

          <div className="flex flex-wrap gap-5 border-b border-border px-[22px] pt-4">
            {[{ key: null, label: "Toutes", n: toutes.length }, ...ORDRE.map((r) => ({ key: r, label: REGISTRES[r].label, n: parRegistre(r).length }))].map((t) => {
              const actif = t.key === onglet;
              return (
                <Link
                  key={t.label}
                  href={t.key ? `/admin?f=${t.key}` : "/admin"}
                  aria-current={actif ? "page" : undefined}
                  className={cn(
                    "whitespace-nowrap border-b-2 pb-[11px] text-[14.5px] transition-colors",
                    actif ? "border-ink font-semibold text-ink" : "border-transparent text-ink-soft hover:text-ink",
                  )}
                >
                  {t.label} <span className="font-mono text-[12px] text-ink-muted">{t.n}</span>
                </Link>
              );
            })}
          </div>

          {/* Le tableau garde une largeur minimale et défile dans son propre
              conteneur : c'est la page qui ne doit jamais partir de travers. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-[14.5px]">
              <thead>
                <tr className="bg-surface-muted">
                  {["Réf.", "Client et console", "Panne", "État", "Prix", ""].map((h, i) => (
                    <th
                      key={h || i}
                      scope="col"
                      className={cn(CELL, "whitespace-nowrap border-b border-border py-[11px] text-left font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-ink-muted")}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.id} data-arow="1" className="border-b border-border-hairline">
                    <td className={cn(CELL, "whitespace-nowrap font-mono text-[13.5px]")}>{l.ref}</td>
                    <td className={CELL}>
                      <span className="block font-semibold">{l.client}</span>
                      <span className="block text-[13px] text-ink-muted">{l.console}</span>
                    </td>
                    <td className={CELL}>{l.panne}</td>
                    <td className={cn(CELL, "whitespace-nowrap")}>
                      <Pastille registre={l.registre} />
                    </td>
                    <td className={cn(CELL, "whitespace-nowrap font-mono text-[13.5px]")}>{l.prix}</td>
                    <td className={cn(CELL, "whitespace-nowrap text-right")}>
                      {/* Chaque ligne porte son action juste, pas une flèche
                          identique partout : c'est ce qui rend la liste
                          utilisable sans réfléchir. */}
                      <Link href={`/admin/orders/${l.id}`} data-open="1" className="font-mono text-[11px] uppercase tracking-[0.07em] text-ink-muted">
                        {REGISTRES[l.registre].action} →
                      </Link>
                    </td>
                  </tr>
                ))}
                {!lignes.length ? (
                  <tr>
                    <td colSpan={6} className={cn(CELL, "text-[14px] text-ink-muted")}>
                      {onglet ? "Aucune réparation dans cet état." : "Aucune réparation en cours."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        {/* ══ colonne de droite ══ */}
        <div className="flex min-w-0 flex-col gap-[22px]">
          <section className={PANNEAU}>
            <h2 className="text-[17px] font-bold tracking-[-0.022em] text-ink">À faire maintenant</h2>
            <span className="mb-3.5 mt-1 block text-[13.5px] text-ink-muted">Par ordre d&apos;urgence.</span>
            {aFaire.length ? (
              <div className="flex flex-col">
                {aFaire.map((t) => (
                  <Link key={t.id} href="#liste" data-arow="1" className="flex items-start gap-[11px] border-t border-border-hairline py-3">
                    <span aria-hidden="true" className={cn("mt-1.5 block h-[7px] w-[7px] shrink-0", t.urgent ? "bg-red" : "bg-ink")} />
                    <span className="min-w-0">
                      <span className="block text-[14.5px] leading-[1.35]">{t.label}</span>
                      <span className="mt-0.5 block font-mono text-[11px] text-ink-muted">{t.meta}</span>
                    </span>
                  </Link>
                ))}
                <span className="border-t border-border-hairline" />
              </div>
            ) : (
              <p className="border-t border-border-hairline py-3 text-[14px] text-ink-muted">Rien n&apos;attend d&apos;action. L&apos;atelier est à jour.</p>
            )}
          </section>

          <section className={PANNEAU}>
            <div className="mb-3.5 flex items-baseline justify-between gap-3">
              <h2 className="text-[17px] font-bold tracking-[-0.022em] text-ink">Commandes boutique</h2>
              <Link href="/admin/shop-orders" className="font-mono text-[10.5px] uppercase tracking-[0.07em] text-ink-muted transition-colors hover:text-red">
                Tout voir
              </Link>
            </div>
            {commandes?.length ? (
              <div className="flex flex-col">
                {commandes.map((c) => {
                  const aExpedier = c.status === "PAID" || (c.status === "PREPARED" && c.fulfillment !== "PICKUP");
                  return (
                    <Link key={c.id} href={`/admin/shop-orders/${c.id}`} data-arow="1" className="flex items-center justify-between gap-3 border-t border-border-hairline py-3">
                      <span className="min-w-0">
                        <span className="block font-mono text-[12.5px]">{c.order_number}</span>
                        <span className="mt-0.5 block text-[13.5px] text-ink-muted">
                          {c.fulfillment === "PICKUP" ? "Retrait magasin" : "Livraison"}
                        </span>
                      </span>
                      <span className="whitespace-nowrap text-right">
                        <span className="block font-mono text-[13.5px]">{formatPrice(c.total_cents)}</span>
                        <span className={cn("mt-0.5 block font-mono text-[10px] uppercase tracking-[0.07em]", aExpedier ? "text-red" : "text-ink-muted")}>
                          {aExpedier ? "À expédier" : c.status === "SHIPPED" ? "Expédiée" : "Prête"}
                        </span>
                      </span>
                    </Link>
                  );
                })}
                <span className="border-t border-border-hairline" />
              </div>
            ) : (
              <p className="border-t border-border-hairline py-3 text-[14px] text-ink-muted">Aucune commande en attente.</p>
            )}
          </section>

          {/* Action rare : reléguée en bas, et c'est délibéré. */}
          <section className={PANNEAU}>
            <h2 className="mb-3.5 text-[17px] font-bold tracking-[-0.022em] text-ink">Ajouter au catalogue</h2>
            <div className="grid grid-cols-2 gap-[9px]">
              {AJOUTS.map((a) => (
                <Link
                  key={a.label}
                  href={a.href}
                  data-act="1"
                  className="border border-border-strong bg-surface px-[11px] py-[13px] text-left text-[14px] font-semibold text-ink"
                >
                  {a.label}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
