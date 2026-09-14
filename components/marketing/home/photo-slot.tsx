import type { CSSProperties, ReactNode } from "react";

/**
 * L'emplacement d'une photo qui n'est pas encore fournie.
 *
 * Le magasin fournira ses propres visuels. En attendant, mettre une photo
 * choisie à sa place serait mentir sur son rayon, et laisser un cadre vide
 * donnerait une page inachevée. On dessine donc une plaque : la lueur de
 * l'accent, une trame fine, et l'initiale du sujet en filigrane. C'est un état
 * prévu par la charte, pas un trou — et il disparaît dès qu'un chemin est
 * renseigné dans `lib/content/assets.ts` ou qu'une photo produit est déposée
 * dans le back-office.
 */
export function PhotoSlot({
  label,
  accent = "rgba(20,17,15,0.06)",
  radius,
  style,
  children,
}: {
  /** Sujet de la photo : son initiale sert de filigrane. */
  label: string;
  /** Accent de la charte porté par la plaque. */
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
        borderRadius: radius,
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
        background: `radial-gradient(130% 120% at 62% 26%, ${accent}, transparent 68%), var(--bg-alt)`,
        ...style,
      }}
    >
      {/* Trame fine : elle donne une matière à la plaque sans figurer quoi que ce soit. */}
      <span
        style={{
          position: "absolute",
          inset: 0,
          // Sur un fond clair, la trame se dessine en encre, pas en lumière.
          background: "repeating-linear-gradient(48deg, rgba(20,17,15,0.05) 0 1px, transparent 1px 11px)",
        }}
      />
      <span
        style={{
          position: "relative",
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: "clamp(54px, 26%, 132px)",
          lineHeight: 1,
          letterSpacing: "-0.06em",
          color: "rgba(20,17,15,0.09)",
        }}
      >
        {initial}
      </span>
      {children}
    </span>
  );
}
