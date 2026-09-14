import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES, SITE_URL } from "@/config/site";
import { HeroRepair, ShiftScene, ShopIntro, StoryScene } from "@/components/marketing/home/scenes";
import { FeaturedGame } from "@/components/marketing/home/featured-game";
import { GamesGrid } from "@/components/marketing/home/games-grid";
import { GamesScene } from "@/components/marketing/home/games-scene";
import { ServicesGrid, ShopRows } from "@/components/marketing/home/shop-sections";
import { getHomepageGames } from "@/lib/shop/games";
import { toGameGrid, toGameScene, toGameScenes } from "@/lib/shop/game-scene";
import { getProducts, productPhotos } from "@/lib/shop/catalog";
import { DEMO_FEATURED_VIDEO } from "@/lib/content/assets";
import { getSeoPage } from "@/lib/content";
import { getBrandSettings } from "@/lib/settings";

/**
 * Accueil — charte v5.
 *
 * Le récit va de la réparation à la boutique : hero, atelier en quatre temps,
 * ce qui passe sur le banc, bascule, puis le rayon — jeu du moment, derniers
 * jeux, consoles, figurines, manga.
 *
 * **La chorégraphie est en CSS** (`position: sticky` + `animation-timeline`,
 * voir app/globals.css). Les seuls composants clients sont ceux qui pilotent
 * une vidéo ou un compteur ; tout le reste est rendu ici, côté serveur.
 *
 * Rendu à la demande : les jeux, leurs prix et leur disponibilité viennent du
 * catalogue. Un rendu statique figerait l'état du magasin au moment du build.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [seo, brand] = await Promise.all([getSeoPage("/"), getBrandSettings()]);
  return {
    title: { absolute: seo?.title ?? `${brand.name} — ${brand.tagline}` },
    description: seo?.description ?? brand.description,
    alternates: { canonical: SITE_URL },
  };
}

export default async function HomePage() {
  // Une seule lecture pour la scène jeux ; les autres rayons lisent le même
  // catalogue, filtré par catégorie. Aucun appel à IGDB : tout vient du cache.
  const [{ featured, latest, isDemo }, consoles, collectibles, accessories] = await Promise.all([
    getHomepageGames(24),
    getProducts({ category: "consoles", availability: "stock", sort: "recent" }, 3),
    getProducts({ category: "collector", sort: "recent" }, 4),
    getProducts({ category: "accessoires", sort: "recent" }, 4),
  ]);

  // Un produit sans photo propre récupère celle de son modèle de console : le
  // catalogue en porte treize, il n'y a aucune raison d'afficher un cadre vide.
  const photos = await productPhotos([...consoles, ...collectibles, ...accessories]);
  const scenes = toGameScenes(latest, isDemo);
  // Au-delà des cinq panneaux chorégraphiés, le reste de la sélection passe en
  // grille : la scène garde ses cinq temps, le rayon garde sa profondeur.
  const grid = toGameGrid(latest, isDemo);
  // Le jeu du moment : celui mis en avant par l'atelier, sinon le premier du
  // rail. Sa lueur suit sa position pour rester cohérente avec la scène.
  const featuredScene = featured ? toGameScene(featured, 0, isDemo) : null;
  // Habillage vidéo de la scène vedette, à défaut d'une vidéo du produit. C'est
  // une boucle fabriquée pour ce projet, pas des images du jeu : l'étiquette
  // « Habillage » le dit au visiteur, et `hero_video_url` la remplace.
  const ambientVideo = { url: DEMO_FEATURED_VIDEO, posterUrl: featuredScene?.artworkUrl ?? null, ambient: true };

  return (
    <>
      {/* Jauge de lecture : pilotée par `animation-timeline: scroll(root)`. */}
      <div data-progress-rail="1" aria-hidden="true" style={{ position: "fixed", top: 0, left: 0, right: 0, height: 2, zIndex: 90, background: "rgba(244,242,255,0.08)" }}>
        <div data-progress-bar="1" style={{ height: 2, width: "100%", background: "linear-gradient(90deg,#d8ff3e,#33e1ff,#7c5cff,#ff7a3d)", transform: "scaleX(0)", transformOrigin: "left" }} />
      </div>

      <HeroRepair />
      <StoryScene />
      <ServicesGrid />
      <ShiftScene />
      <ShopIntro />

      {featuredScene ? <FeaturedGame game={featuredScene} ambientVideo={ambientVideo} /> : null}
      <GamesScene games={scenes} />

      {/* La vitrine de démonstration se présente comme telle : ces jeux ne sont
          pas au catalogue, et rien ne prétend qu'ils sont achetables. */}
      {isDemo ? (
        <section data-warm="1" style={{ background: "#0d0710", padding: "28px 30px 4px" }}>
          <p
            data-reveal="1"
            style={{ margin: "0 auto", maxWidth: 1420, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", lineHeight: 1.6, textTransform: "uppercase", color: "#a89689" }}
          >
            Sélection de démonstration — fiches IGDB, pas encore en rayon. Le stock réel prend leur place dès la première référence saisie.
          </p>
        </section>
      ) : null}

      <GamesGrid games={grid} isDemo={isDemo} />

      {/* Aucun jeu au catalogue : on le dit, on n'affiche pas une scène vide. */}
      {scenes.length === 0 ? (
        <section data-warm="1" style={{ background: "#0d0710", padding: "90px 30px" }}>
          <div style={{ maxWidth: 1420, margin: "0 auto" }}>
            <h2 data-reveal="1" style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(26px,3.6vw,50px)", letterSpacing: "-0.04em", color: "#fff4ea" }}>
              Derniers jeux arrivés
            </h2>
            <p data-reveal="1" style={{ margin: "18px 0 0", maxWidth: "44ch", fontSize: "clamp(15px,1.5vw,18px)", lineHeight: 1.45, color: "#e4c9bd" }}>
              Les arrivages de la semaine ne sont pas encore en ligne. Passez rue de Rome : le rayon, lui, est plein.
            </p>
            <Link href={ROUTES.shop} style={{ display: "inline-flex", alignItems: "center", marginTop: 26, minHeight: 44, background: "#fff4ea", color: "#1a0d06", borderRadius: 999, padding: "17px 28px", fontWeight: 600, fontSize: 16.5 }}>
              Parcourir la boutique
            </Link>
          </div>
        </section>
      ) : null}

      <ShopRows consoles={consoles} collectibles={collectibles} accessories={accessories} photos={photos} />

      {/* Retour à la réparation : la page se referme sur ce qui la commence. */}
      <section id="devis" style={{ position: "relative", background: "#0d0710", padding: "100px 30px 110px" }}>
        <div style={{ maxWidth: 1420, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px,1fr))", gap: 48, alignItems: "center" }}>
          <div data-reveal="1" style={{ minWidth: 0 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#9a95c4" }}>Une console en panne ?</span>
            <h2 style={{ margin: "16px 0 0", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(32px,5.2vw,74px)", lineHeight: 0.9, letterSpacing: "-0.04em" }}>
              Le devis prend trois minutes.
            </h2>
            <p style={{ margin: "20px 0 0", maxWidth: "38ch", fontSize: "clamp(16px,1.6vw,19px)", lineHeight: 1.45, color: "#b9b4e8" }}>
              Choisissez l&apos;appareil et la panne, décrivez ce qui se passe. Diagnostic sous 48 heures, devis avant toute intervention.
            </p>
          </div>
          <div data-reveal="1" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Link href={ROUTES.repair} className="btn-gradient" style={{ borderRadius: 999, padding: "19px 32px", fontWeight: 600, fontSize: 17, color: "var(--color-on-accent)", minHeight: 52, display: "inline-flex", alignItems: "center" }}>
              Démarrer mon devis
            </Link>
            <Link href={ROUTES.tracking} style={{ borderRadius: 999, padding: "19px 30px", border: "1px solid rgba(244,242,255,0.2)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#f4f2ff", minHeight: 52, display: "inline-flex", alignItems: "center" }}>
              Suivre ma réparation
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
