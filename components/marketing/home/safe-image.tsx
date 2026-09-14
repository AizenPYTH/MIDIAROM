"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Image qui s'efface au lieu de casser.
 *
 * Les visuels viennent du CDN d'IGDB : une fiche peut en perdre un, le CDN peut
 * tomber, une URL peut changer. `next/image` laisserait alors l'icône d'image
 * cassée du navigateur au milieu d'une scène soignée. On bascule sur le fond de
 * repli passé en `fallback` — un aplat tenu par la charte, jamais un trou.
 */
export function SafeImage({
  src,
  sizes,
  fallback,
  priority,
  contain,
}: {
  src: string | null;
  sizes: string;
  /** Rendu à la place de l'image si elle manque ou échoue. */
  fallback: React.ReactNode;
  priority?: boolean;
  /** Pour les détourés sur fond blanc, qui ne doivent pas être rognés. */
  contain?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{fallback}</>;
  return (
    <Image
      src={src}
      alt=""
      fill
      sizes={sizes}
      priority={priority}
      onError={() => setFailed(true)}
      style={{ objectFit: contain ? "contain" : "cover", padding: contain ? 14 : 0 }}
      unoptimized
    />
  );
}
