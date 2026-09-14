"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { GameScene } from "@/lib/shop/game-scene";
import { SafeImage } from "@/components/marketing/home/safe-image";
import { TrailerModal, useTrailer } from "@/components/marketing/home/trailer-modal";

/**
 * Jeu vedette : grand visuel, texte en bas à gauche.
 *
 * Le fond suit une règle simple, celle demandée :
 *   video.url présent → vidéo en arrière-plan, artwork dessous en attendant ;
 *   sinon             → artwork seul ;
 *   ni l'un ni l'autre → aplat teinté, jamais un trou noir.
 *
 * La vidéo ne se charge qu'à l'entrée de la section dans l'écran (`preload="none"`
 * + IntersectionObserver), reste muette et se coupe hors champ. Elle est
 * désactivée sous `prefers-reduced-motion` et sur les petits écrans, où elle
 * coûterait de la donnée mobile pour un fond décoratif : l'affiche prend le
 * relais. Rien n'est jamais téléchargé depuis YouTube — la bande-annonce reste
 * une référence ouverte à la demande.
 */

/** En dessous, la vidéo de fond ne se charge pas : l'affiche suffit. */
const VIDEO_MIN_WIDTH = 900;

export function FeaturedGame({ game }: { game: GameScene }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trailer = useTrailer();
  const hasVideo = Boolean(game.video?.url);

  useEffect(() => {
    const section = sectionRef.current;
    const video = videoRef.current;
    const source = game.video;
    if (!section || !video || !source) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.innerWidth < VIDEO_MIN_WIDTH) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          if (video.getAttribute("src") !== source.url) {
            if (source.posterUrl) video.poster = source.posterUrl;
            video.setAttribute("src", source.url);
            video.load();
          }
          video.play().then(() => { video.style.opacity = "1"; }).catch(() => {});
        } else {
          video.pause();
          video.style.opacity = "0";
        }
      },
      { rootMargin: "-15% 0px" },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [game.video]);

  return (
    <section
      ref={sectionRef}
      data-warm="1"
      data-featured="1"
      aria-label={`Le jeu du moment : ${game.name}`}
      style={{ position: "relative", minHeight: "92svh", overflow: "hidden", display: "flex", alignItems: "flex-end", background: "#0d0710" }}
    >
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <div data-featured-art="1" style={{ position: "absolute", inset: "-3%" }}>
          <SafeImage
            src={game.artworkUrl}
            sizes="100vw"
            priority
            fallback={<div style={{ position: "absolute", inset: 0, background: `radial-gradient(120% 90% at 70% 26%, ${game.glow}, #0d0710 66%)` }} />}
          />
        </div>
        {hasVideo ? (
          <video
            ref={videoRef}
            data-featured-video="1"
            muted
            loop
            playsInline
            preload="none"
            aria-hidden="true"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0, transition: "opacity 1.2s cubic-bezier(.16,1,.3,1)" }}
          />
        ) : null}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(13,7,16,0.95) 0%, rgba(13,7,16,0.8) 34%, rgba(13,7,16,0.24) 68%, rgba(13,7,16,0.5) 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(13,7,16,0.8) 0%, rgba(13,7,16,0) 34%, rgba(13,7,16,0.58) 78%, rgba(13,7,16,0.97) 100%)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 1420, margin: "0 auto", padding: "130px 30px 64px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: "44ch" }}>
          <span data-reveal="1" style={{ display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.2em", textTransform: "uppercase", color: "#ffb38a", border: "1px solid rgba(255,179,138,0.4)", borderRadius: 999, padding: "8px 15px", background: "rgba(13,7,16,0.55)" }}>
            <span className="anim-pulse" style={{ width: 6, height: 6, borderRadius: 999, background: "#ff7a3d" }} />
            Le jeu du moment
          </span>

          <h2 data-reveal="1" style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(38px,6.4vw,104px)", lineHeight: 0.86, letterSpacing: "-0.05em", color: "#fff4ea", textShadow: "0 2px 40px rgba(13,7,16,0.85)" }}>
            {game.name}
          </h2>

          {game.pitch ? (
            <p data-reveal="1" style={{ margin: 0, fontSize: "clamp(16px,1.6vw,19.5px)", lineHeight: 1.45, color: "#f0dcd2", textShadow: "0 1px 18px rgba(13,7,16,0.95)" }}>
              {game.pitch}
            </p>
          ) : null}

          {game.meta || game.platforms.length ? (
            <span data-reveal="1" style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#e4c9bd" }}>
              {game.meta ? <span>{game.meta}</span> : null}
              {game.meta && game.platforms.length ? <span style={{ color: "#8a6f63" }}>·</span> : null}
              {game.platforms.length ? <span>{game.platforms.join(", ")}</span> : null}
              {game.price ? (
                <>
                  <span style={{ color: "#8a6f63" }}>·</span>
                  <span style={{ color: "#ff9a5c" }}>{game.price}</span>
                </>
              ) : null}
            </span>
          ) : null}

          <span data-reveal="1" style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
            <Link href={game.href} style={{ background: "#fff4ea", color: "#1a0d06", borderRadius: 999, padding: "19px 32px", fontWeight: 600, fontSize: 17, whiteSpace: "nowrap", minHeight: 44, display: "inline-flex", alignItems: "center" }}>
              Découvrir le jeu →
            </Link>
            {game.trailerYoutubeId ? (
              <button
                type="button"
                onClick={() => trailer.open(game.trailerYoutubeId)}
                style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "1px solid rgba(255,244,234,0.36)", borderRadius: 999, padding: "17px 24px", fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff4ea", whiteSpace: "nowrap", minHeight: 44 }}
              >
                <span style={{ width: 7, height: 7, borderRadius: 999, background: "#ff7a3d" }} />
                Voir le trailer
              </button>
            ) : null}
            {hasVideo ? (
              <span data-featured-sound="1" style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "#a89689" }}>
                Sans son
              </span>
            ) : null}
          </span>
        </div>
      </div>

      <TrailerModal videoId={trailer.videoId} onClose={trailer.close} />
    </section>
  );
}
