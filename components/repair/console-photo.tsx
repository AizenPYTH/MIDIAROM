"use client";

import Image from "next/image";
import { useState } from "react";
import { PhotoSlot } from "@/components/marketing/home/photo-slot";

/**
 * La photo d'un modèle de console, dans la partie réparation.
 *
 * Les treize fichiers de `public/medias/consoles/` sont des **détourés sur fond
 * transparent**, de rapports très différents — 1/1 pour une PS4, 1,6/1 pour une
 * Switch Lite. Deux conséquences, et ce composant n'existe que pour elles :
 *
 *   • `object-contain` : une console se reconnaît à sa silhouette entière. La
 *     recadrer pour remplir un cadre couperait justement ce qui l'identifie ;
 *   • **la plaque, pas l'image, donne la géométrie.** Tous les emplacements ont
 *     donc la même taille quel que soit le rapport du fichier, et la grille ne
 *     se déforme pas d'une console à l'autre.
 *
 * **Client, pour le repli.** Tous les modèles n'ont pas leur détouré : les cinq
 * variantes de PlayStation 5 n'en ont pas encore, et le semis de production
 * déduit le chemin du slug — il peut donc pointer vers un fichier absent.
 * `next/image` laisserait l'icône d'image cassée du navigateur au milieu de la
 * grille ; ici on retombe sur la plaque d'attente de la charte, qui occupe
 * exactement la même place.
 */
export function ConsolePhoto({
  src,
  alt,
  sizes,
  label,
  className = "",
}: {
  /** Chemin public du détouré. `null` affiche directement la plaque d'attente. */
  src: string | null;
  alt: string;
  sizes: string;
  /** Sujet de la plaque d'attente : son initiale sert de filigrane. */
  label: string;
  /** Marge intérieure du cadre, pour que la console ne touche pas le filet. */
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <PhotoSlot label={label} />;
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-contain ${className}`}
    />
  );
}
