import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { GameScene } from "@/lib/shop/game-scene";

/**
 * Un titre ou un bouton de jeu, cliquable ou non selon la réalité du catalogue.
 *
 * Les jeux de la vitrine de démonstration ne sont pas au catalogue : ils n'ont
 * pas de fiche produit. Leur fabriquer une URL serait mentir au visiteur et
 * produire un lien mort. On rend donc le même élément visuel, sans lien et
 * sans affordance de clic, plutôt que d'inventer une cible.
 */

/** Titre : lien vers la fiche réelle, ou simple texte pour une démo. */
export function GameTitle({ game, style, children }: { game: GameScene; style?: CSSProperties; children: ReactNode }) {
  if (!game.href) return <span style={style}>{children}</span>;
  return (
    <Link href={game.href} style={style}>
      {children}
    </Link>
  );
}

/**
 * Action principale. Avec fiche : un bouton plein qui y mène. Sans fiche : une
 * pastille discrète qui annonce l'arrivée en rayon, sans se faire passer pour
 * un bouton d'achat.
 */
export function GameAction({
  game,
  style,
  pendingStyle,
  children,
}: {
  game: GameScene;
  style?: CSSProperties;
  pendingStyle?: CSSProperties;
  children: ReactNode;
}) {
  if (!game.href) {
    return (
      <span
        data-game-pending="1"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          border: "1px solid rgba(255,244,234,0.34)",
          borderRadius: 999,
          padding: "15px 24px",
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#e4c9bd",
          background: "rgba(13,7,16,0.5)",
          whiteSpace: "nowrap",
          minHeight: 44,
          ...pendingStyle,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: 999, background: "#d8ff3e" }} />
        {game.cta}
      </span>
    );
  }
  return (
    <Link href={game.href} style={style}>
      {children}
    </Link>
  );
}
