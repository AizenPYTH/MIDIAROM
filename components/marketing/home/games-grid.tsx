import type { GameScene } from "@/lib/shop/game-scene";
import { GameTitle } from "@/components/marketing/home/game-link";
import { SafeImage } from "@/components/marketing/home/safe-image";

/**
 * Le reste de la sélection, sous la scène chorégraphiée.
 *
 * La scène anime cinq panneaux — c'est une contrainte du CSS, qui découpe la
 * traversée en cinq segments. La sélection, elle, en compte bien plus. Plutôt
 * que de jeter les jeux surnuméraires ou de les laisser muets au milieu du
 * rail, on les présente ici en grille : la vitrine paraît alors ce qu'elle est,
 * un rayon, sans toucher à la chorégraphie.
 *
 * Rendu côté serveur, sans animation pilotée par script : les jaquettes se
 * révèlent avec `[data-reveal]`, comme le reste de la page.
 */
export function GamesGrid({ games, isDemo }: { games: GameScene[]; isDemo: boolean }) {
  if (!games.length) return null;

  return (
    <section data-warm="1" aria-label="Le reste de la sélection" style={{ background: "#0d0710", padding: "8px 30px 96px" }}>
      <div style={{ maxWidth: 1420, margin: "0 auto" }}>
        <div data-reveal="1" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 30 }}>
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(24px,3.2vw,44px)", letterSpacing: "-0.04em", color: "#fff4ea" }}>
            {isDemo ? "Ce qu'on aime, en rayon bientôt" : "Le reste du rayon"}
          </h2>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "#a89689" }}>
            {games.length} titre{games.length > 1 ? "s" : ""}
          </span>
        </div>

        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            // Deux colonnes sur un téléphone, six sur un grand écran : la jaquette
            // reste lisible sans jamais occuper la moitié de la page.
            gridTemplateColumns: "repeat(auto-fill, minmax(clamp(140px, 16vw, 190px), 1fr))",
            gap: "22px 18px",
          }}
        >
          {games.map((game) => (
            <li key={game.productId} data-reveal="1" style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  position: "relative",
                  display: "block",
                  aspectRatio: "3/4",
                  borderRadius: 18,
                  overflow: "hidden",
                  border: "1px solid rgba(255,244,234,0.16)",
                  background: `linear-gradient(165deg, ${game.glow}, rgba(13,7,16,0.9))`,
                  boxShadow: "0 22px 50px rgba(0,0,0,0.45)",
                }}
              >
                <SafeImage
                  src={game.coverUrl}
                  sizes="(max-width: 700px) 46vw, 200px"
                  fallback={
                    <span
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "flex-end",
                        padding: 14,
                        fontFamily: "var(--font-display)",
                        fontWeight: 800,
                        fontSize: 17,
                        lineHeight: 1.05,
                        letterSpacing: "-0.03em",
                        color: "#fff4ea",
                      }}
                    >
                      {game.name}
                    </span>
                  }
                />
              </span>
              <p style={{ margin: "12px 0 0", minWidth: 0 }}>
                <GameTitle
                  game={game}
                  style={{
                    display: "inline-block",
                    minHeight: 44,
                    paddingBlock: 2,
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 15.5,
                    lineHeight: 1.2,
                    letterSpacing: "-0.02em",
                    color: "#fff4ea",
                  }}
                >
                  {game.name}
                </GameTitle>
              </p>
              <span style={{ display: "block", marginTop: "auto", paddingTop: 2, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#a89689" }}>
                {game.platforms[0] ?? game.tag}
                {game.price ? ` · ${game.price}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
