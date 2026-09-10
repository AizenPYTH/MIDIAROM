#!/usr/bin/env node
/**
 * Génère les deux fichiers de données destinés à une base de production DÉJÀ
 * migrée, à partir des catalogues du dépôt :
 *
 *   supabase/catalog.sql             → supabase/seed-production-catalog.sql
 *   supabase/catalog-reparations.sql → supabase/seed-production-repairs.sql
 *
 *   node scripts/build-production-seeds.mjs           # (re)génère
 *   node scripts/build-production-seeds.mjs --check   # échoue si périmés
 *
 * Les fichiers produits ne contiennent que des données : aucun create/alter/drop
 * sur le schéma public, aucune suppression de ligne. Ils sont précédés d'une
 * garde qui refuse de s'exécuter — avec un message explicite — tant que les
 * migrations n'ont pas été appliquées, et suivis d'un état des lieux chiffré.
 *
 * Le contenu métier n'est jamais réécrit : on n'ajoute qu'un en-tête, la garde
 * et la vérification. C'est ce qui garantit que les 887 prestations importées
 * du document du client restent identiques à la ligne près.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SPLIT = "set search_path = public, extensions;";

/** Tables lues ou écrites par chaque fichier : la garde vérifie leur présence. */
const CATALOG_TABLES = [
  "brands", "console_models", "content_blocks", "faq_items", "faults", "legal_documents",
  "option_categories", "pack_items", "packaging_instructions", "packs", "products",
  "repair_included_options", "repair_option_compatibility", "repair_options", "repairs",
  "seo_pages", "shipping_methods", "site_settings", "test_checklist_items", "test_checklists",
  "workshops",
];
const REPAIR_TABLES = ["console_models", "content_blocks", "faults", "repair_categories", "repairs"];

const TARGETS = [
  {
    source: "supabase/catalog.sql",
    output: "supabase/seed-production-catalog.sql",
    title: "DONNÉES DE PRODUCTION — CATALOGUE",
    intro: [
      "Marques, 39 modèles de console, pannes, prestations de départ, options,",
      "packs, transports, contrôles qualité, contenus éditoriaux et documents",
      "légaux.",
      "",
      "Aucun produit de boutique : le stock réel se saisit depuis le back-office",
      "(Stock → Nouveau produit). Tant qu'il est vide, la boutique affiche son",
      "état vide, prévu par le design.",
    ],
    tables: CATALOG_TABLES,
    checks: [
      ["marques", "public.brands"],
      ["modèles de console", "public.console_models"],
      ["pannes", "public.faults"],
      ["prestations", "public.repairs"],
      ["options", "public.repair_options"],
      ["packs", "public.packs"],
      ["formules de transport", "public.shipping_methods"],
      ["produits boutique (le stock réel se saisit dans le back-office)", "public.products"],
    ],
  },
  {
    source: "supabase/catalog-reparations.sql",
    output: "supabase/seed-production-repairs.sql",
    title: "DONNÉES DE PRODUCTION — CATALOGUE DE RÉPARATION DU CLIENT",
    intro: [
      "Les 13 modèles, 35 catégories et 887 prestations du document fourni par",
      "le client. À exécuter APRÈS seed-production-catalog.sql : ce fichier",
      "s'appuie sur les marques et les modèles créés par celui-ci.",
      "",
      "Aucun tarif n'est importé — le document n'en contient pas. Chaque",
      "prestation arrive à 0 € et provisoire : « sur devis » côté client,",
      "« tarif à configurer » dans Catalogue → Réparations. Enregistrer un prix",
      "non nul lève le drapeau.",
    ],
    tables: REPAIR_TABLES,
    checks: [
      ["modèles de console", "public.console_models"],
      ["catégories de réparation", "public.repair_categories"],
      ["prestations rattachées à une catégorie", "public.repairs where category_id is not null"],
      ["prestations au tarif à configurer", "public.repairs where price_is_provisional"],
    ],
  },
];

function header(target) {
  const rule = "-- " + "=".repeat(74);
  const lines = [
    rule,
    `-- ${target.title}`,
    "--",
    ...target.intro.map((l) => (l ? `-- ${l}` : "--")),
    "--",
    "-- FICHIER GÉNÉRÉ — ne pas modifier à la main.",
    `--   source       : ${target.source}`,
    "--   régénération : node scripts/build-production-seeds.mjs",
    "--",
    "-- Ce fichier ne contient QUE des données : aucun create / alter / drop sur le",
    "-- schéma public, aucune suppression de ligne. Les tables doivent déjà exister,",
    "-- elles sont créées par les migrations (supabase/migrations/) — c'est la",
    "-- différence avec supabase/migrations/20260908000002_catalog.sql, qui, lui,",
    "-- crée les tables et échoue en 42P07 sur une base déjà migrée.",
    "--",
    "-- Rejouable autant de fois que nécessaire : chaque insertion est protégée. Une",
    "-- seconde exécution ne crée pas de doublon et n'écrase pas ce qui a été modifié",
    "-- depuis le back-office.",
    "--",
    "-- Deux façons de l'appliquer :",
    "--   • Supabase → SQL Editor : coller le fichier entier puis « Run » ;",
    `--   • en ligne de commande  : psql "$DB_URL" -f ${target.output}`,
    rule,
  ];
  return lines.join("\n");
}

/** Refus explicite si le schéma n'est pas là, plutôt qu'une erreur PostgreSQL brute. */
function guard(tables) {
  return `-- ---------------------------------------------------------------------------
-- Garde : le schéma doit être en place avant toute insertion.
-- ---------------------------------------------------------------------------
do $garde$
declare manquantes text;
begin
  select string_agg(t, ', ' order by t) into manquantes
    from unnest(array[${tables.map((t) => `'${t}'`).join(", ")}]) as t
   where to_regclass('public.' || t) is null;
  if manquantes is not null then
    raise exception using
      message = 'Schéma incomplet, table(s) absente(s) : ' || manquantes,
      hint = 'Appliquez d''abord les migrations (scripts/apply-migrations.sh, ou les fichiers de supabase/migrations/), puis rejouez ce fichier.';
  end if;
end
$garde$;`;
}

function footer(checks) {
  const union = checks
    .map(([label, from], i) => `${i === 0 ? "  select" : "  union all select"} ${String(i + 1).padStart(2)}, '${label}', count(*) from ${from}`)
    .join("\n");
  return `-- ---------------------------------------------------------------------------
-- Rechargement du cache de schéma de PostgREST.
--
-- Sans effet si le schéma n'a pas bougé, mais indispensable juste après une
-- migration : sinon l'API continue d'ignorer les nouvelles tables et le site
-- affiche des listes vides sans la moindre erreur.
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- État des lieux (lecture seule) — dernier résultat affiché par le SQL Editor.
-- ---------------------------------------------------------------------------
select element, nombre from (
${union}
) as etat (ordre, element, nombre)
order by ordre;`;
}

function build(target) {
  const source = readFileSync(join(ROOT, target.source), "utf8");
  const at = source.indexOf(SPLIT);
  if (at === -1) throw new Error(`${target.source} : ligne « ${SPLIT} » introuvable.`);
  const body = source.slice(at + SPLIT.length).trim();
  return [header(target), "", SPLIT, "", guard(target.tables), "", body, "", footer(target.checks), ""].join("\n");
}

const check = process.argv.includes("--check");
let stale = 0;
for (const target of TARGETS) {
  const wanted = build(target);
  const path = join(ROOT, target.output);
  const current = (() => {
    try {
      return readFileSync(path, "utf8");
    } catch {
      return null;
    }
  })();
  if (current === wanted) {
    console.log(`✔ ${target.output} à jour`);
    continue;
  }
  if (check) {
    stale++;
    console.error(`✘ ${target.output} ne correspond plus à ${target.source}`);
    continue;
  }
  writeFileSync(path, wanted);
  console.log(`→ ${target.output} ${current === null ? "créé" : "regénéré"} (${wanted.split("\n").length} lignes)`);
}

if (stale) {
  console.error(`\nRegénérez-les : node scripts/build-production-seeds.mjs`);
  process.exit(1);
}
