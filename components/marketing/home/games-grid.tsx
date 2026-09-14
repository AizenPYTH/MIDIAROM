import Link from "next/link";
import type { GameScene } from "@/lib/shop/game-scene";
import { GameTitle } from "@/components/marketing/home/game-link";
import { PhotoSlot } from "@/components/marketing/home/photo-slot";
import { SafeImage } from "@/components/marketing/home/safe-image";
import { ROUTES } from "@/config/site";
import { CATEGORY_SLUGS } from "@/lib/shop/status";

/**
 * Le rayon jeux vidéo de l'accueil.
 *
 * Il remplace une scène épinglée de 520svh qui faisait défiler cinq jaquettes
 * une par une, avec rail, compteur et vidéo de fond — beaucoup de mécanique
 * pour cinq jeux. Une grille en montre trente d'un coup d'œil, se parcourt au
 * rythme du lecteur, et ne demande aucun JavaScript.
 *
 * **La démonstration se présente comme telle.** Tant que le magasin n'a pas
 * saisi son stock, ces fiches viennent d'IGDB : pas de prix, pas de bouton
 * d'achat, pas de lien vers une fiche produit qui n'existe pas, et un bandeau
 * qui le dit. Dès qu'un vrai jeu entre au catalogue, il prend leur place.
 */
export function GamesGrid({ games, isDemo }: { games: GameScene[]; isDemo: boolean }) {
  if (!games.length) return null;

  return (
    <section data-warm="1" aria-label="Jeux vidéo" style={{ background: "#0d0710", padding: "64px 30px 88px" }}>
      <div style={{ maxWidth: 1420, margin: "0 auto" }}>
        <div data-reveal="1" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(24px,3.2vw,44px)", letterSpacing: "-0.04em", color: "#fff4ea" }}>
            Jeux vidéo
          </h3>
          <Link href={`${ROUTES.shop}?cat=${CATEGORY_SLUGS.GAME}`} style={{ display: "inline-flex", alignItems: "center", minHeight: 44, fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "#ffb38a" }}>
            Tout le rayon →
          </Link>
        </div>

        {/* Le bandeau de démonstration. Il n'apparaît que si ces jeux ne sont
            pas au catalogue, et il est explicite : personne ne doit croire
            qu'on vend ce qu'on n'a pas. */}
        {isDemo ? (
          <p
            data-reveal="1"
            style={{ margin: "0 0 30px", padding: "13px 18px", borderRadius: 14, border: "1px dashed rgba(255,244,234,0.22)", background: "rgba(255,244,234,0.03)", fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.6, letterSpacing: "0.06em", textTransform: "uppercase", color: "#a89689" }}
          >
            Sélection de démonstration · fiches IGDB · pas encore en rayon. Passez au magasin ou demandez-nous un titre : on le commande.
          </p>
        ) : (
          <div style={{ height: 30 }} />
        )}

        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            // Deux colonnes sur un téléphone, six sur un grand écran : la
            // jaquette reste lisible sans occuper la moitié de la page.
            gridTemplateColumns: "repeat(auto-fill, minmax(clamp(140px, 16vw, 200px), 1fr))",
            gap: "28px 18px",
          }}
        >
          {games.map((game) => (
            <li key={game.productId} data-reveal="1" style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
              <span
                className="card-lift"
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
                  // Jaquette absente : la plaque de la charte, pas le titre
                  // répété — il est déjà écrit juste en dessous.
                  fallback={<PhotoSlot label={game.name} accent={game.glow} />}
                />
              </span>
              <p style={{ margin: "12px 0 0", minWidth: 0 }}>
                <GameTitle
                  game={game}
                  style={{ display: "inline-block", minHeight: 40, paddingBlock: 2, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15.5, lineHeight: 1.2, letterSpacing: "-0.02em", color: "#fff4ea" }}
                >
                  {game.name}
                </GameTitle>
              </p>
              <span style={{ display: "block", marginTop: "auto", paddingTop: 2, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#a89689" }}>
                {[game.platforms[0], game.price].filter(Boolean).join(" · ") || game.tag}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
