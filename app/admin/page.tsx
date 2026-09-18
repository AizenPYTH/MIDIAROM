import Link from "next/link";
import { requireStaffOrRedirect } from "@/lib/security/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRayons } from "@/lib/shop/categories";
import { rayonsPublics } from "@/lib/shop/rayons";
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

/** Le traitement visuel d'un état. Chaque registre, une lecture. */
const PASTILLE: Record<Registre, string> = {
  // La balle est chez le client : le seul rouge de la liste.
  attente: "border-[#f3c9cb] bg-[#fdecec] text-[#a8161c]",
  /*
    « À chiffrer » n'est pas rouge, et ce n'est pas un oubli.

    Le rouge de cet écran ne dit qu'une chose : ce qui dépend du client. Une
    demande de devis dépend de l'atelier — c'est lui qui doit répondre. Elle
    porte donc la teinte de marque : la plus visible des couleurs qui ne
    signalent pas une attente extérieure.
  */
  devis: "border-brand bg-brand text-white",
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

const PANNEAU = "bg-surface p-5";

/**
 * Les raccourcis de publication. Action rare, donc en bas de colonne.
 *
 * Un par rayon public — le vendeur qui ouvre « Cartes à collectionner » le
 * retrouve ici sans qu'on ait rien à redéployer —, plus la prestation, qui
 * relève de l'atelier et non de la boutique. On s'arrête à trois rayons : la
 * grille en compte deux par ligne, et l'ajout au catalogue ne doit pas
 * reprendre le haut de la page.
 */
function ajoutsDe(rayons: { code: string; label: string; slug: string }[]): { label: string; href: string }[] {
  return [
    ...rayons.slice(0, 3).map((r) => ({ label: r.label, href: `/admin/annonces/nouvelle?cat=${r.slug}` })),
    { label: "Une prestation", href: "/admin/catalog/repairs/new" },
  ];
}

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
  const rayons = rayonsPublics(await getRayons());
  const AJOUTS = ajoutsDe(rayons);

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
  /*
    Les chiffrages d'abord.

    Une relance attend une réponse déjà demandée ; un chiffrage n'a même pas
    encore commencé, et le client ne peut rien faire tant qu'il n'est pas
    parti. C'est donc lui qui bloque, et il bloque un dossier où rien n'a été
    encaissé — la seule chose que l'atelier puisse perdre en l'oubliant, c'est
    le client lui-même.
  */
  const chiffrages = parRegistre("devis")
    .slice(0, 3)
    .map((l) => ({
      id: l.id,
      label: `Chiffrer la demande de ${l.client} — ${l.console}`,
      meta: `${l.ref} · ${l.panne}`,
      urgent: true,
    }));

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

  const aFaire = [...chiffrages, ...relances, ...colis, ...diagnostics];

  return (
    <>
      <div data-admin-v9="1" className="w-full">
        {/*
          « À faire maintenant » — premier dans le balisage, donc premier sur
          téléphone, et remis dans la colonne de droite par la grille sur
          ordinateur. Sur bande noire : c'est la seule chose qu'on lit en
          arrivant, et elle est déduite de la liste, jamais saisie.
        */}
        {/* ── Cinq nombres, rien de plus. Chacun filtre la liste. ─────────── */}
        <div data-kpi="1">
          {ORDRE.map((r) => {
            const n = parRegistre(r).length;
            const actif = onglet === r;
            return (
              <Link
                key={r}
                href={actif ? "/admin#liste" : `/admin?f=${r}#liste`}
                data-act-kpi="1"
                aria-current={actif ? "true" : undefined}
                className="flex flex-col gap-1.5 bg-surface p-5"
                style={{ borderBottomColor: actif ? "var(--ink-900)" : "transparent" }}
              >
                <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint">{REGISTRES[r].label}</span>
                {/* Un seul compteur en rouge : celui qui bloque le chiffre
                    d'affaires. L'étendre reviendrait à ne plus rien signaler. */}
                <span
                  data-n="1"
                  className={cn(
                    "text-[34px] font-extrabold leading-none tracking-[-0.04em] sm:text-[44px]",
                    (r === "attente" || r === "devis") && n > 0 ? "text-brand" : "text-ink",
                  )}
                >
                  {n}
                </span>
                <span className="text-[13.5px] text-ink-faint">{REGISTRES[r].note}</span>
              </Link>
            );
          })}
        </div>

        {/* ══ la liste : le contenu de l'écran ══ */}
        <section id="liste" data-liste="1" className="min-w-0 bg-surface">
          <div className="flex flex-wrap items-end justify-between gap-4 px-4 pt-5 sm:px-[22px]">
            <h1 className="text-[22px] font-bold tracking-[-0.028em] text-ink sm:text-[25px]">
              Réparations <span className="font-mono text-[13px] font-normal text-ink-faint">{toutes.length}</span>
            </h1>
            {/* Sur téléphone, « Nouvelle réparation » vit dans la barre basse :
                le répéter ici prendrait une ligne pour rien. */}
            <Link href="/admin/reception" className="hidden bg-brand px-[18px] py-3 text-[14.5px] font-semibold text-white transition-colors hover:bg-ink sm:inline-block">
              Nouvelle réparation
            </Link>
          </div>

          {/* Rail au doigt : cinq onglets ne tiennent pas sur 390 px sans
              descendre sous la cible tactile. */}
          <div data-rail="1" className="-mx-4 mt-4 flex gap-5 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-[22px]">
            {[{ key: null, label: "Toutes", n: toutes.length }, ...ORDRE.map((r) => ({ key: r, label: REGISTRES[r].label, n: parRegistre(r).length }))].map((t) => {
              const actif = t.key === onglet;
              return (
                <Link
                  key={t.label}
                  href={t.key ? `/admin?f=${t.key}#liste` : "/admin#liste"}
                  aria-current={actif ? "page" : undefined}
                  data-tab="1"
                  /*
                    Jamais `border-bottom` en raccourci piloté par l'état : la
                    couleur suit immédiatement, la bordure avec un rendu de
                    retard, et l'onglet choisi s'affiche sans soulignement
                    pendant que le précédent garde le sien. Base statique en
                    classe, longhands seuls en ligne.
                  */
                  className={cn("flex shrink-0 items-center whitespace-nowrap border-b-2 border-transparent pb-[11px] text-[14.5px] transition-colors min-h-[44px] sm:min-h-0", actif ? "font-semibold" : "")}
                  style={{ borderBottomColor: actif ? "var(--ink-900)" : "transparent", color: actif ? "var(--text)" : "var(--text-2)" }}
                >
                  {t.label} <span className="ml-1.5 font-mono text-[12px] text-ink-faint">{t.n}</span>
                </Link>
              );
            })}
          </div>

          {/* En-têtes de colonnes : seulement là où il y a des colonnes. */}
          <div data-rep="1" data-rephead="1" aria-hidden="true" className="border-b border-border bg-surface-muted font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
            <span data-c="ref">Réf.</span>
            <span data-c="client">Client et console</span>
            <span data-c="panne">Panne</span>
            <span data-c="badge">État</span>
            <span data-c="prix">Prix</span>
            <span data-c="action" />
          </div>

          <div className="flex flex-col">
            {lignes.map((l) => (
              <Link key={l.id} href={`/admin/orders/${l.id}`} data-rep="1" data-arow="1" className="border-b border-border-hairline">
                <span data-c="ref" className="font-mono text-[13.5px]">{l.ref}</span>
                <span data-c="badge">
                  <Pastille registre={l.registre} />
                </span>
                <span data-c="client" className="min-w-0">
                  <span className="block font-semibold leading-[1.3]">{l.client}</span>
                  <span className="block text-[13px] text-ink-faint">{l.console}</span>
                </span>
                <span data-c="panne" className="min-w-0 text-[14px] text-ink-soft">{l.panne}</span>
                <span data-c="sep" aria-hidden="true" />
                <span data-c="prix" className="font-mono text-[15px] font-bold min-[860px]:text-[13.5px] min-[860px]:font-normal">{l.prix}</span>
                {/* Chaque ligne porte son action juste, pas une flèche identique
                    partout : c'est ce qui rend la liste utilisable sans réfléchir. */}
                <span data-c="action" data-open="1" className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.07em] text-ink-faint">
                  {REGISTRES[l.registre].action} →
                </span>
              </Link>
            ))}
            {!lignes.length ? (
              <p className="px-4 py-6 text-[14px] text-ink-faint sm:px-[22px]">{onglet ? "Aucune réparation dans cet état." : "Aucune réparation en cours."}</p>
            ) : null}
          </div>
        </section>

        {/* ══ le reste de la colonne de droite ══ */}
        {/*
          La colonne de droite de l'ordinateur — et, sous 1081 px, deux blocs
          qui remontent dans le flux du parent (`display: contents`) pour se
          placer aux deux extrémités : « À faire maintenant » en tête,
          le reste en pied.
        */}
        <div data-col2="1">
        <section data-now="1" className="bg-ink p-5 text-on-dark-2">
          <h2 className="text-[17px] font-bold tracking-[-0.022em] text-on-dark">À faire maintenant</h2>
          <span className="mb-3.5 mt-1 block text-[13.5px] text-on-dark-3">Par ordre d&apos;urgence.</span>
          {aFaire.length ? (
            <div className="flex flex-col">
              {aFaire.map((t) => (
                <Link
                  key={t.id}
                  href="#liste"
                  className="flex min-h-[44px] items-start gap-[11px] py-3 lg:min-h-0"
                  style={{ borderTop: "1px solid rgba(244,244,246,0.16)" }}
                >
                  <span aria-hidden="true" className={cn("mt-1.5 block h-[7px] w-[7px] shrink-0", t.urgent ? "bg-brand" : "bg-on-dark-3")} />
                  <span className="min-w-0">
                    <span className="block text-[14.5px] leading-[1.35] text-on-dark">{t.label}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-on-dark-3">{t.meta}</span>
                  </span>
                </Link>
              ))}
              <span aria-hidden="true" style={{ borderTop: "1px solid rgba(244,244,246,0.16)" }} />
            </div>
          ) : (
            <p className="py-3 text-[14px] text-on-dark-3" style={{ borderTop: "1px solid rgba(244,244,246,0.16)" }}>
              Rien n&apos;attend d&apos;action. L&apos;atelier est à jour.
            </p>
          )}
        </section>

        <div data-side="1" className="flex min-w-0 flex-col gap-0.5">
          <section className={PANNEAU}>
            <div className="mb-3.5 flex items-baseline justify-between gap-3">
              <h2 className="text-[17px] font-bold tracking-[-0.022em] text-ink">Commandes boutique</h2>
              <Link href="/admin/shop-orders" className="font-mono text-[10.5px] uppercase tracking-[0.07em] text-ink-faint transition-colors hover:text-brand">
                Tout voir
              </Link>
            </div>
            {commandes?.length ? (
              <div className="flex flex-col">
                {commandes.map((c) => {
                  const aExpedier = c.status === "PAID" || (c.status === "PREPARED" && c.fulfillment !== "PICKUP");
                  return (
                    <Link key={c.id} href={`/admin/shop-orders/${c.id}`} data-arow="1" className="flex min-h-[44px] items-center justify-between gap-3 border-t border-border-hairline py-3 lg:min-h-0">
                      <span className="min-w-0">
                        <span className="block font-mono text-[12.5px]">{c.order_number}</span>
                        <span className="mt-0.5 block text-[13.5px] text-ink-faint">{c.fulfillment === "PICKUP" ? "Retrait magasin" : "Livraison"}</span>
                      </span>
                      <span className="whitespace-nowrap text-right">
                        <span className="block font-mono text-[13.5px]">{formatPrice(c.total_cents)}</span>
                        <span className={cn("mt-0.5 block font-mono text-[10px] uppercase tracking-[0.07em]", aExpedier ? "text-brand" : "text-ink-faint")}>
                          {aExpedier ? "À expédier" : c.status === "SHIPPED" ? "Expédiée" : "Prête"}
                        </span>
                      </span>
                    </Link>
                  );
                })}
                <span className="border-t border-border-hairline" />
              </div>
            ) : (
              <p className="border-t border-border-hairline py-3 text-[14px] text-ink-faint">Aucune commande en attente.</p>
            )}
          </section>

          {/* Action rare : reléguée en bas de colonne, et c'est délibéré. */}
          <section className={PANNEAU}>
            <h2 className="mb-3.5 text-[17px] font-bold tracking-[-0.022em] text-ink">Ajouter au catalogue</h2>
            <div className="grid grid-cols-2 gap-0.5">
              {AJOUTS.map((a) => (
                <Link
                  key={a.label}
                  href={a.href}
                  data-act="1"
                  className="flex min-h-[44px] items-center border border-border-strong bg-surface px-[11px] py-[13px] text-left text-[14px] font-semibold text-ink lg:min-h-0"
                >
                  {a.label}
                </Link>
              ))}
            </div>
          </section>
        </div>
        </div>
      </div>

      {/*
        La barre basse du téléphone. « Nouvelle réparation » doit rester sous le
        pouce : c'est le seul geste qui crée quelque chose depuis cet écran.
        `box-sizing` et `env(safe-area-inset-bottom)` sont indispensables — sans
        eux la barre passe sous la barre de gestes de l'iPhone.
      */}
      <div aria-hidden="true" className="h-[68px] sm:hidden" />
      <div
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex gap-0.5 border-t border-border-strong bg-bg px-4 pt-2.5 sm:hidden"
        style={{ boxSizing: "border-box", ["--safe-pb" as string]: "10px" }}
      >
        <Link href="/admin#liste" className="flex min-h-[48px] shrink-0 items-center justify-center border border-border-strong bg-surface px-[17px] font-mono text-[11px] uppercase tracking-[0.06em] text-ink">
          Réparations
        </Link>
        <Link href="/admin/reception" className="flex min-h-[48px] flex-1 items-center justify-center bg-brand text-[16.5px] font-semibold text-white">
          Nouvelle réparation
        </Link>
      </div>
    </>
  );
}
