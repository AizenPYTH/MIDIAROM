"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createListingAction, type NewListingState } from "@/app/admin/actions/listings";
import type { Rayon } from "@/lib/shop/rayons";
import { PhotoPicker } from "@/components/admin/photo-picker";

/**
 * Le formulaire court d'une nouvelle annonce.
 *
 * Six champs, et pas un de plus. Le SKU, le slug, le seuil de stock, l'ordre
 * d'affichage et les quinze autres colonnes de la table sont déduits ou
 * laissés à leur défaut : ils se règlent sur la fiche complète, qui s'ouvre
 * juste après, quand on sait déjà quoi mettre dedans.
 *
 * L'exemple de plateforme change avec le rayon : « PlayStation 5 » pour un jeu,
 * « One Piece » pour une figurine. C'est le champ que les gens remplissent le
 * moins bien, parce que son nom ne dit pas ce qu'on attend.
 */

/**
 * Les exemples sont rédigés pour les trois rayons d'origine ; un rayon ouvert
 * au back-office n'en a pas, et le champ garde alors son intitulé neutre —
 * mieux vaut pas d'exemple qu'un exemple qui parle d'autre chose.
 */
const EXEMPLES: Record<string, { platform: string; name: string }> = {
  GAME: { platform: "PlayStation 5", name: "EA Sports FC 26" },
  CONSOLE: { platform: "PlayStation 5", name: "PS5 Slim — pack manette" },
  COLLECTIBLE: { platform: "One Piece", name: "Figurine Luffy Gear 5" },
};

const ETATS: { value: string; label: string }[] = [
  { value: "NEW", label: "Neuf" },
  { value: "REFURBISHED", label: "Révisé en atelier" },
  { value: "USED_A", label: "Occasion — très bon état" },
  { value: "USED_B", label: "Occasion — bon état" },
  { value: "USED_C", label: "Occasion — état correct" },
];

const CHAMP =
  "w-full rounded-[2px] border border-border-strong bg-field px-3.5 py-3 text-[16px] text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none sm:text-[15px]";

function Label({ htmlFor, children, hint }: { htmlFor: string; children: React.ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1.5">
      <span className="text-[14px] font-semibold text-ink">{children}</span>
      {hint ? <span className="text-[13px] leading-[1.4] text-ink-muted">{hint}</span> : null}
    </label>
  );
}

export function NewListingForm({ initialCategory, rayons }: { initialCategory: string; rayons: Rayon[] }) {
  const [state, action, pending] = useActionState<NewListingState, FormData>(createListingAction, { status: "idle" });
  const [category, setCategory] = useState<string>(initialCategory);
  const exemple = EXEMPLES[category] ?? EXEMPLES.CONSOLE!;
  const motTag = rayons.find((r) => r.code === category)?.tagLabel || "plateforme";

  return (
    <form action={action} className="mt-7 flex max-w-[640px] flex-col gap-6">
      {state.status === "error" ? (
        <p role="alert" className="rounded-[2px] border border-danger bg-danger-soft px-4 py-3 text-[14px] text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="category">Qu&apos;est-ce que vous vendez&#8239;?</Label>
        <div className="flex flex-wrap gap-2">
          {rayons.map((r) => {
            const c = r.code;
            return (
            <label
              key={c}
              className={`cursor-pointer border px-4 py-3 text-[14.5px] font-medium transition-colors ${
                category === c ? "border-ink bg-ink text-white" : "border-border-strong text-ink hover:border-ink"
              }`}
            >
              <input
                type="radio"
                name="category"
                value={c}
                id={c === category ? "category" : undefined}
                checked={category === c}
                onChange={() => setCategory(c)}
                className="sr-only"
              />
              {r.label}
            </label>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nom de l&apos;article</Label>
        <input id="name" name="name" required placeholder={exemple.name} className={CHAMP} />
      </div>

      <div className="flex flex-col gap-2">
        {/* Le mot vient du rayon (`product_categories.tag_label`), pas d'un test
            sur un code écrit ici : un rayon ouvert par le vendeur apporte le
            sien, et « One Piece » cesse d'être présenté comme une plateforme. */}
        <Label htmlFor="platform" hint={motTag === "licence" ? "La licence : One Piece, Naruto, Demon Slayer…" : "La console concernée."}>
          {motTag.charAt(0).toUpperCase() + motTag.slice(1)}
        </Label>
        <input id="platform" name="platform" required placeholder={exemple.platform} className={CHAMP} />
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="condition">État</Label>
          <select id="condition" name="condition" defaultValue="NEW" className={CHAMP}>
            {ETATS.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="price">Prix de vente</Label>
          <input id="price" name="price" required inputMode="decimal" placeholder="49,90" className={CHAMP} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="quantity">Quantité</Label>
          <input id="quantity" name="quantity" type="number" min={0} defaultValue={1} className={CHAMP} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description" hint="Facultatif — vous pourrez l'écrire plus tard.">
          Description
        </Label>
        <textarea id="description" name="description" rows={4} className={CHAMP} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="photos" hint="La première est celle que la boutique montre en vignette.">
          Photos
        </Label>
        <PhotoPicker />
      </div>

      {/*
        Par défaut, l'article n'est pas en ligne. La case existe quand même —
        c'est le magasin qui décide, pas nous.
      */}
      <label htmlFor="publish" className="flex items-start gap-3 border border-border bg-surface-muted p-4">
        <input id="publish" name="publish" type="checkbox" className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--brand)]" />
        <span className="text-[14px] leading-[1.45] text-ink-soft">
          <strong className="font-semibold text-ink">Mettre en ligne tout de suite.</strong> Sans cette case, l&apos;article est créé
          hors ligne : vous le complétez sur sa fiche, puis vous le publiez.
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-[2px] bg-brand px-7 py-3.5 text-[15.5px] font-semibold text-white transition-colors hover:bg-ink disabled:opacity-50"
        >
          {pending ? "Création…" : "Créer l'article"}
        </button>
        <Link href="/admin" className="text-[14.5px] text-ink-soft transition-colors hover:text-brand">
          Annuler
        </Link>
      </div>
    </form>
  );
}
