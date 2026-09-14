import type { CSSProperties, ReactNode } from "react";

/**
 * L'emplacement d'une photo que le magasin n'a pas encore fournie.
 *
 * Mettre une image choisie à sa place mentirait sur le rayon ; laisser un cadre
 * vide donnerait une page inachevée. On dessine donc une plaque : un aplat
 * sourd, une trame fine, et l'initiale du sujet en filigrane. C'est un état
 * prévu par la charte, pas un trou — et il disparaît dès qu'une photo est
 * déposée dans le back-office ou qu'un chemin est renseigné dans
 * `lib/content/assets.ts`.
 *
 * Sans teinte de couleur : cette direction n'a qu'un rouge, et il est réservé à
 * six emplois. Une plaque d'attente n'en fait pas partie.
 *
 * Emplacements attendus sur l'accueil, avec la photo que chacun réclame :
 *
 *   hero          composition à plat : console ouverte, manette, composants
 *   plateformes   PlayStation sur l'établi · Switch démontée · Xbox ouverte ·
 *                 consoles rétro en vitrine            (4 visuels, 16/10)
 *   atelier       image d'attente de la vidéo — plan d'atelier
 *   rayons        rayon jeux vidéo · rayon consoles · vitrine figurines de
 *                 **personnages** de manga et d'anime  (3 visuels, 4/3)
 *   magasin       façade ou intérieur, 207 rue de Rome
 */
export function PhotoSlot({
  label,
  radius,
  style,
  children,
}: {
  /** Sujet de la photo : son initiale sert de filigrane. */
  label: string;
  /** Conservé pour les appelants existants ; cette direction n'arrondit rien. */
  accent?: string;
  radius?: number;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const initial = label.trim().charAt(0).toUpperCase() || "·";
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: radius ?? 0,
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
        background: "var(--bg-sunken)",
        ...style,
      }}
    >
      {/* Trame fine : elle donne une matière à la plaque sans figurer quoi que ce soit. */}
      <span
        style={{
          position: "absolute",
          inset: 0,
          background: "repeating-linear-gradient(48deg, rgba(15,15,17,0.05) 0 1px, transparent 1px 11px)",
        }}
      />
      <span
        style={{
          position: "relative",
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: "clamp(54px, 26%, 132px)",
          lineHeight: 1,
          letterSpacing: "-0.06em",
          color: "rgba(15,15,17,0.08)",
        }}
      >
        {initial}
      </span>
      {children}
    </span>
  );
}
