import { CATEGORY_SHORT } from "@/lib/shop/status";

/**
 * La vignette d'un article dont la photo n'est pas encore déposée.
 *
 * Un rayon se remplit avant que le photographe passe. La plaque d'attente
 * générique — un aplat gris et l'initiale du nom en filigrane — convient à un
 * emplacement isolé de l'accueil ; alignée huit fois dans une grille, elle
 * donne un catalogue en panne. Or la carte connaît déjà trois choses qu'un
 * client cherche : le rayon, la plateforme et le titre.
 *
 * On dessine donc une jaquette avec ces trois-là, dans la typographie de la
 * maison. Le résultat se lit, se différencie d'une carte à l'autre, et se
 * remplace par la vraie photo dès qu'elle est déposée dans la fiche produit.
 *
 * Elle ne prétend pas être une photo : pas de faux reflet, pas d'image
 * empruntée à un éditeur ou à un fabricant. C'est un carton d'attente, et il
 * en a l'air.
 *
 * **Sur le même fond clair qu'une photo de produit.** Une vignette noire à
 * côté d'une photo détourée sur blanc attirait l'œil sur l'article qui n'a
 * justement rien à montrer, et la grille se lisait en damier. Le rayon se
 * remplira photo par photo : les deux états doivent peser pareil.
 *
 * **Une seule vignette pour deux tailles.** Elle sert la carte de 150 px du
 * rayon et le carré de 640 px de la fiche produit. Plutôt que deux variantes à
 * tenir d'accord, la typographie se mesure en `cqw` — un pourcentage de la
 * largeur du cadre —, donc la composition est la même partout et reste lisible
 * aux deux bouts.
 *
 * `aria-hidden` : le nom, la plateforme et l'état sont déjà écrits en toutes
 * lettres à côté. Les répéter ferait lire deux fois le même article.
 */
export function ProductTile({ name, platform, category }: { name: string; platform: string; category: string }) {
  return (
    <span
      aria-hidden="true"
      className="absolute inset-0 flex flex-col justify-end overflow-hidden bg-surface-strong text-ink"
      style={{ containerType: "inline-size", padding: "clamp(12px, 4cqw, 28px)" }}
    >
      {/* La même trame que la plaque d'attente de l'accueil : elle donne une
          matière au carton sans figurer quoi que ce soit. */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{ background: "repeating-linear-gradient(48deg, rgba(15,15,17,0.05) 0 1px, transparent 1px 11px)" }}
      />
      {/* Le rayon, discret, en haut à droite : le coin en haut à gauche porte
          déjà le badge d'état. */}
      <span
        className="absolute font-mono uppercase text-ink-faint"
        style={{
          top: "clamp(12px, 4cqw, 28px)",
          right: "clamp(12px, 4cqw, 28px)",
          fontSize: "clamp(9px, 1.9cqw, 12px)",
          letterSpacing: "0.12em",
        }}
      >
        {CATEGORY_SHORT[category] ?? category}
      </span>
      <span className="relative flex flex-col" style={{ gap: "clamp(6px, 1.6cqw, 12px)" }}>
        <span className="block bg-red" style={{ height: 2, width: "clamp(24px, 9cqw, 54px)" }} />
        <span
          className="font-display font-bold line-clamp-4"
          style={{ fontSize: "clamp(13px, 5.5cqw, 30px)", lineHeight: 1.16, letterSpacing: "-0.03em" }}
        >
          {name}
        </span>
        <span className="font-mono uppercase text-ink-muted" style={{ fontSize: "clamp(9.5px, 2cqw, 13px)", letterSpacing: "0.1em" }}>
          {platform}
        </span>
      </span>
    </span>
  );
}
