"use client";

import Image from "next/image";
import { useState } from "react";
import { PhotoSlot } from "@/components/marketing/home/photo-slot";

/**
 * Un visuel de l'accueil.
 *
 * Un seul composant pour les cinq emplacements de la page : ils ont tous les
 * mêmes exigences — remplir leur cadre sans déformer le sujet, garder le point
 * focal au recadrage, et ne se charger tôt que pour celui qu'on voit avant de
 * défiler.
 *
 * **Client, et pour une raison précise** : si un fichier manque, `next/image`
 * laisserait l'icône d'image cassée du navigateur au milieu de la page. Ici on
 * bascule sur la plaque de la charte — un état prévu, jamais un trou. C'est ce
 * qui permet de câbler les chemins avant que les photos soient déposées.
 *
 * Le fichier local est optimisé par Next (redimensionnement, WebP ou AVIF selon
 * le navigateur) : un PNG de plusieurs mégaoctets n'est jamais servi tel quel.
 */
export function HomeVisual({
  src,
  alt,
  sizes,
  priority = false,
  label,
  position = "center",
  positionMobile,
}: {
  src: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  /** Sujet de la plaque d'attente si le fichier manque. */
  label: string;
  /** Point focal conservé au recadrage sur grand écran. */
  position?: string;
  /**
   * Point focal sous 700 px, où le cadre devient nettement plus étroit.
   * Sans lui, un recadrage centré coupe le sujet principal en deux.
   */
  positionMobile?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <PhotoSlot label={label} />;
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      // Le hero est au-dessus de la ligne de flottaison : il se charge en
      // priorité. Les quatre autres attendent d'approcher de l'écran.
      priority={priority}
      loading={priority ? undefined : "lazy"}
      onError={() => setFailed(true)}
      data-visual="1"
      className="object-cover"
      style={{ "--pos": position, "--pos-sm": positionMobile ?? position } as React.CSSProperties}
    />
  );
}
