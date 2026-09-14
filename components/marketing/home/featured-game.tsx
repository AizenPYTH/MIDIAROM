"use client";

import { useEffect, useRef } from "react";
import type { GameScene } from "@/lib/shop/game-scene";
import { GameAction } from "@/components/marketing/home/game-link";
import { SafeImage } from "@/components/marketing/home/safe-image";
import { TrailerModal, useTrailer } from "@/components/marketing/home/trailer-modal";

/**
 * Jeu vedette — scène immersive.
 *
 * La section fait trois hauteurs d'écran et épingle son plateau : pendant la
 * traversée, un masque circulaire ouvre l'image, l'artwork recule en parallaxe,
 * un voile s'assombrit et le texte se découvre ligne à ligne. Toute cette
 * chorégraphie est en CSS (`position: sticky` + `animation-timeline: --featured`,
 * voir app/globals.css) : elle ne dépend d'aucun cycle de vie JavaScript, et le
 * repli `@supports not` la ramène à un écran fixe entièrement lisible.
 *
 * Le fond suit une règle simple :
 *   vidéo disponible → vidéo en arrière-plan, artwork dessous en attendant ;
 *   sinon            → artwork seul ;
 *   ni l'un ni l'autre → aplat teinté par la lueur du jeu, jamais un trou noir.
 *
 * Le seul rôle du script ici est la vidéo : `preload="none"` jusqu'à l'entrée
 * dans l'écran, lecture muette, pause hors champ. Rien n'est jamais téléchargé
 * depuis YouTube — la bande-annonce reste une référence ouverte à la demande.
 */

/** En dessous, la vidéo de fond ne se charge pas : l'affiche suffit. */
const VIDEO_MIN_WIDTH = 900;

export interface FeaturedVideo {
  url: string;
  posterUrl: string | null;
  /**
   * Vrai quand la vidéo est un habillage d'ambiance fourni par l'atelier et non
   * des images du jeu. L'affichage le dit : on n'attribue pas au jeu une vidéo
   * qui n'est pas la sienne.
   */
  ambient?: boolean;
}

export function FeaturedGame({ game, ambientVideo }: { game: GameScene; ambientVideo?: FeaturedVideo | null }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trailer = useTrailer();
  // La vidéo du produit prime toujours ; l'habillage ne sert qu'à défaut.
  const video: FeaturedVideo | null = game.video ?? ambientVideo ?? null;
  /**
   * Une vidéo du jeu remplace l'image. Un habillage, non : il se superpose en
   * lumière (`screen`) pour animer l'artwork sans le masquer — l'affiche reste
   * le sujet, la boucle n'est qu'un mouvement de lumière par-dessus.
   */
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
      data-featured="1"
      aria-label={`Le jeu du moment : ${game.name}`}
      style={{ position: "relative", height: "300svh", background: "#0d0710" }}
    >
      <div
        data-feat-stage="1"
        style={{ position: "sticky", top: 0, height: "100svh", overflow: "hidden", display: "flex", alignItems: "flex-end" }}
      >
        {/* Le masque : l'image s'ouvre en cercle à l'entrée de la scène. */}
        <div data-feat-mask="1" style={{ position: "absolute", inset: 0, zIndex: 0, clipPath: "circle(160% at 62% 42%)" }}>
          {/* Lueur du jeu, sous l'image : elle porte la couleur même sans visuel. */}
          <div
            data-feat-glow="1"
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: "-20%",
              background: `radial-gradient(46% 46% at 62% 40%, ${game.glow}, transparent 70%)`,
              filter: "blur(40px)",
            }}
          />
          <div data-featured-art="1" style={{ position: "absolute", inset: "-6%" }}>
            <SafeImage
              src={game.artworkUrl}
              sizes="100vw"
              priority
              fallback={
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: `radial-gradient(120% 90% at 70% 26%, ${game.glow}, #0d0710 66%)`,
                  }}
                />
              }
            />
          </div>
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
          {/* Balayage de lumière : passe une fois, à l'ouverture. */}
          <span
            data-feat-sweep="1"
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "-20%",
              bottom: "-20%",
              left: 0,
              width: "38%",
              background: "linear-gradient(100deg, transparent, rgba(255,244,234,0.16), transparent)",
              opacity: 0,
              pointerEvents: "none",
            }}
          />
        </div>

        {/* Bascule image → texte : le voile s'installe pendant la lecture. */}
        <div
          data-feat-scrim="1"
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            opacity: 0.15,
            background:
              "linear-gradient(90deg, rgba(13,7,16,0.98) 0%, rgba(13,7,16,0.94) 30%, rgba(13,7,16,0.52) 58%, rgba(13,7,16,0.18) 78%, rgba(13,7,16,0.6) 100%), linear-gradient(180deg, rgba(13,7,16,0.86) 0%, rgba(13,7,16,0.1) 32%, rgba(13,7,16,0.6) 74%, rgba(13,7,16,0.98) 100%)",
          }}
        />

        <div data-feat-body="1"
          style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 1420, margin: "0 auto", padding: "clamp(86px,11svh,120px) 30px clamp(44px,7svh,72px)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: "44ch" }}>
            <span
              data-feat-line="1"
              style={{
                display: "inline-flex",
                alignSelf: "flex-start",
                alignItems: "center",
                gap: 10,
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "#ffb38a",
                border: "1px solid rgba(255,179,138,0.4)",
                borderRadius: 999,
                padding: "8px 15px",
                background: "rgba(13,7,16,0.55)",
              }}
            >
              <span className="anim-pulse" style={{ width: 6, height: 6, borderRadius: 999, background: "#ff7a3d" }} />
              {game.isDemo ? "Sélection de la boutique" : "Le jeu du moment"}
            </span>

            <h2
              data-feat-line="1"
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: "clamp(34px,5.4vw,86px)",
                lineHeight: 0.86,
                letterSpacing: "-0.05em",
                color: "#fff4ea",
                textShadow: "0 2px 40px rgba(13,7,16,0.85)",
              }}
            >
              {game.name}
            </h2>

            {game.pitch ? (
              <p
                data-feat-line="1"
                style={{
                  margin: 0,
                  fontSize: "clamp(16px,1.6vw,19.5px)",
                  lineHeight: 1.45,
                  color: "#f0dcd2",
                  textShadow: "0 1px 18px rgba(13,7,16,0.95)",
                }}
              >
                {game.pitch}
              </p>
            ) : null}

            {game.meta || game.platforms.length ? (
              <span
                data-feat-line="1"
                style={{
                  display: "flex",
                  gap: 18,
                  flexWrap: "wrap",
                  alignItems: "center",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "#e4c9bd",
                }}
              >
                <span>{[game.meta, game.platforms.join(", ")].filter(Boolean).join(" · ")}</span>
                {game.price ? <span style={{ color: "#ff9a5c" }}>{game.price}</span> : null}
              </span>
            ) : null}

            <span data-feat-line="1" style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
              <GameAction
                game={game}
                pendingStyle={{ padding: "17px 26px" }}
                style={{
                  background: "#fff4ea",
                  color: "#1a0d06",
                  borderRadius: 999,
                  padding: "19px 32px",
                  fontWeight: 600,
                  fontSize: 17,
                  whiteSpace: "nowrap",
                  minHeight: 44,
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                Découvrir le jeu →
              </GameAction>
              {game.trailerYoutubeId ? (
                <button
                  type="button"
                  onClick={() => trailer.open(game.trailerYoutubeId)}
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "transparent",
                    border: "1px solid rgba(255,244,234,0.36)",
                    borderRadius: 999,
                    padding: "17px 24px",
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "#fff4ea",
                    whiteSpace: "nowrap",
                    minHeight: 44,
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: "#ff7a3d" }} />
                  Voir le trailer
                </button>
              ) : null}
              {video ? (
                <span
                  data-featured-sound="1"
                  style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "#a89689" }}
                >
                  {video.ambient ? "Habillage — sans son" : "Sans son"}
                </span>
              ) : null}
            </span>
          </div>
        </div>

        {/* Invitation à dérouler : disparaît dès que la scène est engagée. */}
        <span
          data-feat-hint="1"
          aria-hidden="true"
          style={{
            position: "absolute",
            right: 30,
            bottom: 34,
            zIndex: 3,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontFamily: "var(--font-mono)",
            fontSize: 9.5,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#a89689",
          }}
        >
          Défilez
          <span style={{ width: 34, height: 1, background: "linear-gradient(90deg, #a89689, transparent)" }} />
        </span>
      </div>

      <TrailerModal videoId={trailer.videoId} onClose={trailer.close} />
    </section>
  );
}
