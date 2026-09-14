"use client";

import { useEffect, useRef } from "react";
import type { GameScene } from "@/lib/shop/game-scene";
import { GameAction } from "@/components/marketing/home/game-link";
import { SafeImage } from "@/components/marketing/home/safe-image";
import { TrailerModal, useTrailer } from "@/components/marketing/home/trailer-modal";

/**
 * Le jeu du moment : un écran, un grand visuel, une action.
 *
 * La scène faisait 300svh avec un plateau épinglé, un masque circulaire, un
 * balayage de lumière, une parallaxe et une révélation ligne à ligne. Cinq
 * effets pour une information. Il en reste **un** : l'artwork se pose
 * doucement à l'entrée dans l'écran. Le reste est immobile et lisible tout de
 * suite.
 *
 * La vidéo ne se charge qu'à l'entrée de la section (`preload="none"` +
 * IntersectionObserver), reste muette et se coupe hors champ. Elle est
 * désactivée sous `prefers-reduced-motion` et sur les petits écrans, où elle
 * coûterait de la donnée mobile pour un fond décoratif. Rien n'est jamais
 * téléchargé depuis YouTube : la bande-annonce reste une référence ouverte à
 * la demande.
 */

/** En dessous, la vidéo de fond ne se charge pas : l'affiche suffit. */
const VIDEO_MIN_WIDTH = 900;

export interface FeaturedVideo {
  url: string;
  posterUrl: string | null;
  /**
   * Vrai quand la vidéo est un habillage fourni par l'atelier et non des images
   * du jeu. L'affichage le dit : on n'attribue pas au jeu une vidéo qui n'est
   * pas la sienne.
   */
  ambient?: boolean;
}

export function FeaturedGame({ game, ambientVideo }: { game: GameScene; ambientVideo?: FeaturedVideo | null }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trailer = useTrailer();
  const video: FeaturedVideo | null = game.video ?? ambientVideo ?? null;
  /** Un habillage se superpose en lumière ; il ne remplace pas l'affiche. */
  const ambient = Boolean(video?.ambient);

  useEffect(() => {
    const section = sectionRef.current;
    const element = videoRef.current;
    if (!section || !element || !video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.innerWidth < VIDEO_MIN_WIDTH) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          if (element.getAttribute("src") !== video.url) {
            if (video.posterUrl) element.poster = video.posterUrl;
            element.setAttribute("src", video.url);
            element.load();
          }
          element
            .play()
            .then(() => {
              element.style.opacity = ambient ? "0.5" : "1";
            })
            .catch(() => {});
        } else {
          element.pause();
          element.style.opacity = "0";
        }
      },
      { rootMargin: "-15% 0px" },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [video, ambient]);

  return (
    <section
      ref={sectionRef}
      data-warm="1"
      aria-label={`Le jeu du moment : ${game.name}`}
      // Pas d'`overflow: hidden` ici : un ancêtre qui masque le débordement
      // devient un conteneur de défilement, et `animation-timeline: view()` s'y
      // accroche au lieu de la page. Les révélations restaient alors figées à
      // mi-course. Le découpage se fait sur le cadre de l'artwork, en dessous.
      style={{ position: "relative", minHeight: "min(92svh, 760px)", display: "flex", alignItems: "flex-end", background: "#0d0710" }}
    >
      <div data-feat-art="1" style={{ position: "absolute", inset: 0, zIndex: 0, overflow: "hidden" }}>
        <SafeImage
          src={game.artworkUrl}
          sizes="100vw"
          priority
          fallback={<div style={{ position: "absolute", inset: 0, background: `radial-gradient(120% 90% at 68% 26%, ${game.glow}, #0d0710 66%)` }} />}
        />
        {video ? (
          <video
            ref={videoRef}
            data-featured-video="1"
            muted
            loop
            playsInline
            preload="none"
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0,
              mixBlendMode: ambient ? "screen" : "normal",
              transition: "opacity 1.2s cubic-bezier(.16,1,.3,1)",
            }}
          />
        ) : null}
      </div>

      {/* Le voile qui rend le texte lisible. Fixe : il n'a pas besoin de bouger. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          background:
            "linear-gradient(90deg, rgba(13,7,16,0.97) 0%, rgba(13,7,16,0.9) 32%, rgba(13,7,16,0.45) 60%, rgba(13,7,16,0.2) 80%, rgba(13,7,16,0.6) 100%), linear-gradient(180deg, rgba(13,7,16,0.82) 0%, rgba(13,7,16,0.08) 34%, rgba(13,7,16,0.6) 76%, rgba(13,7,16,0.98) 100%)",
        }}
      />

      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 1420, margin: "0 auto", padding: "clamp(96px,12svh,140px) 30px clamp(48px,7svh,76px)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: "42ch" }}>
          <span data-reveal="1" style={{ display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.2em", textTransform: "uppercase", color: "#ffb38a", border: "1px solid rgba(255,179,138,0.4)", borderRadius: 999, padding: "8px 15px", background: "rgba(13,7,16,0.55)" }}>
            <span className="anim-pulse" style={{ width: 6, height: 6, borderRadius: 999, background: "#ff7a3d" }} />
            {game.isDemo ? "Coup de cœur de l'équipe" : "Le jeu du moment"}
          </span>

          <h2 data-reveal="1" style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(34px,5.2vw,82px)", lineHeight: 0.88, letterSpacing: "-0.05em", color: "#fff4ea", textShadow: "0 2px 40px rgba(13,7,16,0.85)" }}>
            {game.name}
          </h2>

          {game.pitch ? (
            <p data-reveal="1" style={{ margin: 0, fontSize: "clamp(16px,1.6vw,19px)", lineHeight: 1.45, color: "#f0dcd2", textShadow: "0 1px 18px rgba(13,7,16,0.95)" }}>
              {game.pitch}
            </p>
          ) : null}

          {game.meta || game.platforms.length ? (
            <span data-reveal="1" style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#e4c9bd" }}>
              <span>{[game.meta, game.platforms.join(", ")].filter(Boolean).join(" · ")}</span>
              {game.price ? <span style={{ color: "#ff9a5c" }}>{game.price}</span> : null}
            </span>
          ) : null}

          <span data-reveal="1" style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
            <GameAction
              game={game}
              pendingStyle={{ padding: "17px 26px" }}
              style={{ background: "#fff4ea", color: "#1a0d06", borderRadius: 999, padding: "18px 30px", fontWeight: 600, fontSize: 16.5, whiteSpace: "nowrap", minHeight: 44, display: "inline-flex", alignItems: "center" }}
            >
              Voir la fiche →
            </GameAction>
            {game.trailerYoutubeId ? (
              <button
                type="button"
                onClick={() => trailer.open(game.trailerYoutubeId)}
                style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "1px solid rgba(255,244,234,0.36)", borderRadius: 999, padding: "16px 24px", fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff4ea", whiteSpace: "nowrap", minHeight: 44 }}
              >
                <span style={{ width: 7, height: 7, borderRadius: 999, background: "#ff7a3d" }} />
                Bande-annonce
              </button>
            ) : null}
            {video ? (
              <span data-featured-sound="1" style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "#a89689" }}>
                {video.ambient ? "Habillage — sans son" : "Sans son"}
              </span>
            ) : null}
          </span>
        </div>
      </div>

      <TrailerModal videoId={trailer.videoId} onClose={trailer.close} />
    </section>
  );
}
