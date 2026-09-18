"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { ROUTES } from "@/config/site";
import { publicMediaUrl } from "@/components/marketing/gallery";
import { AddToCartButton } from "@/components/shop/cart-widgets";
import { CONDITION_SHORT, stockLabel, type ProductCondition } from "@/lib/shop/status";
import { libelleDe, type Rayon } from "@/lib/shop/rayons";
import { formatPrice } from "@/lib/utils/format";
import { BANNIERES, BanniereEditoriale } from "@/components/marketing/home/banniere";

/**
 * « En rayon cette semaine » — les quatre filtres et le mur de produits.
 *
 * Client, parce que les filtres filtrent vraiment : ils ne rechargent pas la
 * page et ne fabriquent pas une taxonomie à côté. Le tri porte sur la
 * **catégorie brute du produit**, jamais sur le libellé affiché — c'est la
 * règle du handoff, et c'est ce qui empêche un renommage d'intitulé de casser
 * silencieusement le filtre.
 *
 * Les produits viennent du catalogue réel : prix, stock et photos sont ceux de
 * la base. Il n'y a pas de repli de maquette — un produit inventé sur la page
 * d'accueil d'un vrai magasin est un mensonge commercial.
 */
export interface RayonProduit {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  quantity: number;
  seuil: number;
  condition: ProductCondition;
  category: string;
  platform: string;
  image: string | null;
}

/**
 * Les filtres : « Tout », puis un par rayon public.
 *
 * Ils ne sont plus écrits en dur. Le vendeur peut ouvrir un rayon depuis le
 * back-office, et le mur d'accueil le propose le jour même. Le tri porte sur le
 * **code** du rayon, jamais sur le libellé affiché — c'est ce qui permet de
 * renommer « Figurines Manga / Anime » sans casser silencieusement le filtre.
 *
 * Les libellés du mur sont courts : la puce fait 44 px de haut et il en tient
 * quatre sur 390 px. Un rayon dont le nom de section est long garde donc son
 * premier mot ici.
 */
function courts(rayons: readonly Rayon[]): { label: string; cat: string | null }[] {
  return [
    { label: "Tout", cat: null },
    ...rayons.map((r) => ({ label: r.label.split(/\s+[—/·]\s+|\s+/)[0] ?? r.label, cat: r.code })),
  ];
}

/**
 * Le badge, et sa couleur.
 *
 * Le rouge ne signale que ce qui sort de l'ordinaire — une console révisée en
 * atelier, un collector. « Neuf » est fréquent : il reste en encre. Étendre le
 * rouge à tout ce qui est neuf reviendrait à ne plus rien signaler.
 */
function badgeDe(p: RayonProduit): { texte: string; rouge: boolean } | null {
  if (p.quantity <= 0) return { texte: "Épuisé", rouge: false };
  if (p.condition === "REFURBISHED") return { texte: "Révisé atelier", rouge: true };
  if (p.condition === "NEW") return { texte: "Neuf", rouge: false };
  return null;
}

function Carte({ produit, rayons }: { produit: RayonProduit; rayons: readonly Rayon[] }) {
  const href = `${ROUTES.shop}/${produit.slug}`;
  const badge = badgeDe(produit);
  const stock = stockLabel(produit.quantity, produit.seuil, produit.condition);

  return (
    <div data-card="1" className="flex min-w-0 flex-col border border-transparent bg-surface">
      {/*
        Carré + `object-contain` + 16 px de retrait.
        Les photos du magasin ont des formats très différents — de 0,55 à 2,10.
        Un `cover` amputerait une figurine debout comme une console à plat ;
        `contain` les montre entières, et le carré commun garde la grille
        d'aplomb d'une ligne à l'autre.
      */}
      <Link href={href} className="relative block overflow-hidden bg-surface-muted" style={{ aspectRatio: "1 / 1" }}>
        {produit.image ? (
          <Image src={publicMediaUrl(produit.image)} alt={produit.name} fill sizes="(max-width: 700px) 50vw, 240px" className="object-contain p-3 sm:p-4" />
        ) : (
          <span className="absolute inset-0 grid place-items-center px-3 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
            {produit.name}
          </span>
        )}
        {badge ? (
          <span
            className={`absolute left-2 top-2 px-[7px] py-1 font-mono text-[9px] uppercase tracking-[0.06em] text-white sm:left-[11px] sm:top-[11px] sm:px-[9px] sm:py-[5px] sm:text-[9.5px] sm:tracking-[0.07em] ${badge.rouge ? "bg-brand" : "bg-ink"}`}
          >
            {badge.texte}
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:gap-[7px] sm:p-4">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.05em] text-ink-faint sm:text-[10px] sm:tracking-[0.06em]">
          {libelleDe(rayons, produit.category)} · {CONDITION_SHORT[produit.condition]}
        </span>
        <Link href={href} className="flex-1 text-[14px] font-semibold leading-[1.3] tracking-[-0.012em] sm:text-[15px] sm:leading-[1.32]">
          {produit.name}
        </Link>
        <span className="flex items-baseline justify-between gap-1.5 sm:gap-2.5">
          <span className="text-[17px] font-bold tracking-[-0.028em] sm:text-[19px] sm:tracking-[-0.03em]">{formatPrice(produit.priceCents)}</span>
          <span className="whitespace-nowrap font-mono text-[9px] uppercase text-ink-faint sm:text-[10px] sm:tracking-[0.05em]">{stock}</span>
        </span>
        <span data-add="1" className="mt-[3px] block">
          <AddToCartButton productId={produit.id} available={produit.quantity} className="min-h-[44px] w-full border border-ink bg-transparent px-2 py-[11px] text-[13.5px] font-semibold text-ink sm:min-h-0 sm:px-3 sm:py-3 sm:text-[14px]" />
        </span>
      </div>
    </div>
  );
}

export function RayonV9({ produits, total, rayons }: { produits: RayonProduit[]; total: number; rayons: Rayon[] }) {
  const [actif, setActif] = useState<string>("Tout");
  const FILTRES = useMemo(() => courts(rayons), [rayons]);

  const montres = useMemo(() => {
    const f = FILTRES.find((x) => x.label === actif);
    const liste = !f || f.cat === null ? produits : produits.filter((p) => p.category === f.cat);
    return liste.slice(0, 12);
  }, [produits, actif, FILTRES]);

  return (
    <section id="rayon" className={`mx-auto w-full max-w-[var(--page-max)] px-[clamp(16px,4.08vw,51px)] pt-[clamp(32px,4.08vw,51px)]`}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-5">
        <h3 className="m-0 text-[clamp(20px,1.68vw,21px)] font-bold tracking-[-0.03em]">En rayon cette semaine</h3>
        {/* Rail au doigt sous `sm` : quatre chips de 44 px ne tiennent pas sur
            une ligne de 360 px sans devenir des cibles trop petites. */}
        <span data-rail="1" className="-mx-[clamp(16px,4.08vw,51px)] flex gap-[7px] overflow-x-auto px-[clamp(16px,4.08vw,51px)] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {FILTRES.map((f) => {
            const on = f.label === actif;
            return (
              <button
                key={f.label}
                type="button"
                onClick={() => setActif(f.label)}
                aria-pressed={on}
                /*
                  Jamais de propriété raccourcie pilotée par l'état.
                  `background:` ou `border:` dont la valeur vient de l'état
                  s'applique avec un rendu de retard alors que `color` suit
                  immédiatement : le chip actif apparaissait en blanc sur blanc.
                  Base statique en classes, longhands seuls en ligne.
                */
                className="shrink-0 cursor-pointer whitespace-nowrap border px-[14px] py-2.5 font-mono text-[11px] uppercase tracking-[0.05em] min-h-[44px] sm:min-h-0"
                style={{
                  backgroundColor: on ? "var(--ink-900)" : "transparent",
                  borderColor: on ? "var(--ink-900)" : "var(--stroke-strong)",
                  color: on ? "#ffffff" : "var(--text-2)",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </span>
      </div>

      {montres.length ? (
        /*
          La bannière 2 est **dans** la grille, pas à côté.

          C'est le geste qui distingue une vraie boutique d'un site avec des
          publicités : le lecteur parcourt quatre produits, rencontre une
          campagne, puis reprend sa lecture. La grille garde son rythme de part
          et d'autre, donc l'affiche ne peut pas se lire comme un encart ajouté.

          Elle est injectée à l'index 4 — une rangée sur grand écran, deux
          rangées sur téléphone où la grille est à deux colonnes : dans les deux
          cas, après quelque chose à lire, jamais en ouverture. Elle prend toute
          la largeur de la grille (`grid-column: 1 / -1`) et garde son 3/1.
        */
        <div data-g-prod="1">
          {montres.map((p, i) => (
            <Fragment key={p.id}>
              {i === 4 ? (
                <div style={{ gridColumn: "1 / -1" }} className="py-[22px]">
                  <BanniereEditoriale {...BANNIERES.callOfDuty} />
                </div>
              ) : null}
              <Carte produit={p} rayons={rayons} />
            </Fragment>
          ))}
        </div>
      ) : (
        <div className="py-[34px] text-center">
          <span className="block text-[16px] text-ink-faint">Aucun produit dans ce filtre.</span>
          <button
            type="button"
            onClick={() => setActif("Tout")}
            data-btn="1"
            className="mt-3.5 inline-block cursor-pointer border border-ink px-[22px] py-3.5 text-[15px] font-semibold text-ink hover:bg-ink hover:text-white"
          >
            Tout voir
          </button>
        </div>
      )}

      <div className="mt-[18px] flex justify-center sm:mt-[30px]">
        <Link href={ROUTES.shop} data-btn="1" className="block w-full border border-ink px-8 py-[17px] text-center text-[16px] font-semibold text-ink hover:bg-ink hover:text-white sm:w-auto sm:py-4">
          Voir tout le catalogue{total ? ` · ${total} références` : ""}
        </Link>
      </div>
    </section>
  );
}
