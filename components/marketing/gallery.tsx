import Image from "next/image";
import type { Tables } from "@/types/database";
import { getPublicEnv } from "@/lib/env";

/**
 * URL d'une photo de la galerie ou d'un média public.
 *
 * Deux origines possibles, pour la même colonne `image_path` :
 *   • un chemin commençant par « / » désigne un fichier livré avec le site
 *     (public/), pour les visuels fixes de la marque — la façade du magasin ;
 *   • tout autre chemin désigne un objet du bucket public `content-media`,
 *     téléversé depuis le back-office (Contenu → Galerie → Médias publics).
 */
export function publicMediaUrl(path: string): string {
  if (path.startsWith("/")) return path;
  const env = getPublicEnv();
  return `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/content-media/${path}`;
}

export function GalleryGrid({ items }: { items: Tables<"gallery_items">[] }) {
  if (!items.length) return null;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.id} className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="relative aspect-[4/3] bg-surface-muted">
            <Image src={publicMediaUrl(item.image_path)} alt={item.title ?? "Photo de l'atelier"} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
          </div>
          {item.title || item.description ? (
            <div className="p-4">
              {item.title ? <p className="font-medium text-ink">{item.title}</p> : null}
              {item.description ? <p className="mt-1 text-sm text-ink-muted">{item.description}</p> : null}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
