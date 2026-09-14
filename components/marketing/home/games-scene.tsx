"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { GameScene } from "@/lib/shop/game-scene";
import { SafeImage } from "@/components/marketing/home/safe-image";
import { TrailerModal, useTrailer } from "@/components/marketing/home/trailer-modal";

/**
 * Scène « Derniers jeux » : le jeu actif occupe le fond, son panneau passe
 * devant, le rail de jaquettes sert de sélecteur.
 *
 * **La chorégraphie n'est pas ici.** Fonds, panneaux, barre de progression et
 * révélations sont pilotés par `animation-timeline: --games` dans
 * app/globals.css, sur une scène `position: sticky`. Ce composant ne fait que
 * ce que le CSS ne sait pas faire :
 *
 *   - déduire l'index actif de la position de défilement (compteur « 03 / 05 ») ;
 *   - éclaircir la jaquette active dans le rail et la ramener au centre ;
 *   - charger et jouer la vidéo du seul jeu affiché ;
 *   - ouvrir la bande-annonce à la demande.
 *
 * Conséquence voulue : si ce script ne s'exécute jamais, la scène reste
 * entièrement fonctionnelle et lisible — seuls le compteur, le centrage et la
 * vidéo manquent.
 */

/** Délai avant de charger une vidéo : un défilement rapide n'en déclenche aucune. */
const VIDEO_DELAY_MS = 420;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function GamesScene({ games }: { games: GameScene[] }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [active, setActive] = useState(0);
  const trailer = useTrailer();

  // Index actif déduit du défilement — pas d'épinglage, pas de déclencheur à
  // perdre au redimensionnement.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || games.length === 0) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      const progress = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;
      setActive(Math.min(games.length - 1, Math.floor(progress * games.length * 0.999)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [games.length]);

  // Le rail ramène la jaquette active au centre.
  useEffect(() => {
    const chip = chipRefs.current[active];
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!chip || !viewport) return;
    if (viewport.scrollWidth > viewport.clientWidth) {
      // Rail défilant (mobile) : on déplace le conteneur.
      viewport.scrollTo({
        left: chip.offsetLeft - viewport.clientWidth / 2 + chip.offsetWidth / 2,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    } else if (track) {
      const x = viewport.clientWidth / 2 - (chip.offsetLeft + chip.offsetWidth / 2);
      track.style.transform = `translateX(${Math.min(30, x)}px)`;
    }
  }, [active]);

  // Une seule vidéo dans le DOM, chargée uniquement pour le jeu affiché.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const source = games[active]?.video;
    if (!source || prefersReducedMotion()) {
      video.pause();
      video.style.opacity = "0";
      video.removeAttribute("src");
      video.load();
      return;
    }
    video.style.opacity = "0";
    video.pause();
    const timer = setTimeout(() => {
      if (video.getAttribute("src") !== source.url) {
        if (source.posterUrl) video.poster = source.posterUrl;
        video.setAttribute("src", source.url);
        video.load();
      }
      const reveal = () => {
        video.style.opacity = "1";
      };
      video.play().then(reveal).catch(() => {
        // Lecture refusée (économie d'énergie, onglet masqué) : l'artwork reste.
      });
    }, VIDEO_DELAY_MS);
    return () => clearTimeout(timer);
  }, [active, games]);

  // Une vidéo ne tourne pas dans un onglet en arrière-plan.
  useEffect(() => {
    const onVisibility = () => {
      const video = videoRef.current;
      if (!video?.getAttribute("src")) return;
      if (document.hidden) video.pause();
      else void video.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  /** Cliquer une jaquette déplace le défilement dans le segment du jeu ; le CSS fait le reste. */
  const goTo = (index: number) => {
    const section = sectionRef.current;
    if (!section) return;
    const rect = section.getBoundingClientRect();
    const span = rect.height - window.innerHeight;
    if (span <= 0) return;
    window.scrollTo({
      top: rect.top + window.scrollY + span * ((index + 0.5) / games.length),
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
    setActive(index);
  };

  if (games.length === 0) return null;

  return (
    <section
      ref={sectionRef}
      data-warm="1"
      data-games="1"
      aria-label="Derniers jeux arrivés"
      style={{ position: "relative", background: "#0d0710", height: "520svh" }}
    >
      <div
        data-games-stage="1"
        style={{ position: "sticky", top: 0, height: "100svh", overflow: "hidden", display: "flex", flexDirection: "column" }}
      >
        {/* Fonds : un calque par jeu, seul l'actif est opaque (piloté par le CSS). */}
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          {games.map((game) => (
            <div key={`bg-${game.productId}`} data-game-bg="1" style={{ position: "absolute", inset: 0 }}>
              <div data-game-art="1" style={{ position: "absolute", inset: "-4%" }}>
                {/* Sans artwork — ou si le CDN ne répond pas — un aplat teinté
                    de la lueur du jeu, jamais un trou noir. */}
                <SafeImage
                  src={game.artworkUrl}
                  sizes="100vw"
                  fallback={<div style={{ position: "absolute", inset: 0, background: `radial-gradient(120% 90% at 70% 30%, ${game.glow}, #0d0710 68%)` }} />}
                />
              </div>
              <div style={{ position: "absolute", inset: 0, background: `radial-gradient(120% 90% at 78% 18%, ${game.glow} 0%, rgba(13,7,16,0) 62%)` }} />
            </div>
          ))}
          <video
            ref={videoRef}
            data-game-video="1"
            muted
            loop
            playsInline
            preload="none"
            aria-hidden="true"
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
              opacity: 0, transition: "opacity 1.1s cubic-bezier(.16,1,.3,1)",
            }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(13,7,16,0.94) 0%, rgba(13,7,16,0.78) 38%, rgba(13,7,16,0.32) 72%, rgba(13,7,16,0.6) 100%)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(13,7,16,0.88) 0%, rgba(13,7,16,0) 30%, rgba(13,7,16,0.5) 74%, rgba(13,7,16,0.96) 100%)" }} />
        </div>

        {/* En-tête de section */}
        <div style={{ position: "relative", zIndex: 3, flex: "0 0 auto", padding: "clamp(76px, 11svh, 108px) 30px 0" }}>
          <div style={{ maxWidth: 1420, margin: "0 auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
            <h2 data-reveal="1" style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(26px,3.6vw,50px)", letterSpacing: "-0.04em", color: "#fff4ea" }}>
              Derniers jeux arrivés
            </h2>
            <span style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "#c9a695", whiteSpace: "nowrap" }}>
              Arrivages du vendredi
              <span data-game-index="1" style={{ color: "#fff4ea" }}>
                {String(active + 1).padStart(2, "0")} / {String(games.length).padStart(2, "0")}
              </span>
            </span>
          </div>
        </div>

        {/* Panneaux : un par jeu */}
        <div style={{ position: "relative", zIndex: 3, flex: "1 1 auto", minHeight: 0, padding: "16px 30px", display: "flex", alignItems: "flex-end" }}>
          <div style={{ position: "relative", width: "100%", alignSelf: "stretch", maxWidth: 1420, margin: "0 auto" }}>
            {games.map((game, index) => (
              <div
                key={`panel-${game.productId}`}
                data-game-panel="1"
                style={{
                  position: "absolute", inset: 0, overflow: "hidden", display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px,1fr))", gap: 36, alignItems: "end",
                  pointerEvents: index === active ? "auto" : "none",
                }}
              >
                <div data-game-col="1" style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
                  <h3 data-game-el="1" data-game-title="1" style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(30px,4.6vw,68px)", lineHeight: 0.9, letterSpacing: "-0.045em", color: "#fff4ea", textShadow: "0 2px 30px rgba(13,7,16,0.8)" }}>
                    {/* Le titre est un lien : il lui faut la même cible tactile
                        qu'un bouton, qu'il tienne sur une ligne ou sur trois. */}
                    <Link href={game.href} style={{ color: "inherit", display: "inline-block", minHeight: 44, paddingBlock: 4 }}>
                      {game.name}
                    </Link>
                  </h3>
                  {game.pitch ? (
                    <p data-game-el="1" style={{ margin: 0, fontSize: "clamp(15px,1.5vw,17.5px)", lineHeight: 1.45, maxWidth: "38ch", color: "#f0dcd2", textShadow: "0 1px 16px rgba(13,7,16,0.9)" }}>
                      {game.pitch}
                    </p>
                  ) : null}
                  {game.platforms.length ? (
                    <span data-game-el="1" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {game.platforms.map((platform) => (
                        <span key={platform} style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", border: "1px solid rgba(255,244,234,0.34)", borderRadius: 999, padding: "8px 13px", color: "#fff4ea", background: "rgba(13,7,16,0.5)", whiteSpace: "nowrap" }}>
                          {platform}
                        </span>
                      ))}
                    </span>
                  ) : null}
                  {game.meta ? (
                    <span data-game-el="1" data-game-meta="1" style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "#c9a695" }}>
                      {game.meta}
                    </span>
                  ) : null}
                  <span data-game-el="1" data-game-cta="1" style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                    <Link href={game.href} style={{ background: "#fff4ea", color: "#1a0d06", borderRadius: 999, padding: "17px 28px", fontWeight: 600, fontSize: 16.5, whiteSpace: "nowrap", minHeight: 44, display: "inline-flex", alignItems: "center" }}>
                      {game.cta}
                      {game.price ? ` · ${game.price}` : ""}
                    </Link>
                    {game.trailerYoutubeId ? (
                      <button
                        type="button"
                        onClick={() => trailer.open(game.trailerYoutubeId)}
                        style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "1px solid rgba(255,244,234,0.34)", borderRadius: 999, padding: "15px 22px", fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff4ea", whiteSpace: "nowrap", minHeight: 44 }}
                      >
                        <span style={{ width: 7, height: 7, borderRadius: 999, background: "#ff7a3d" }} />
                        Trailer
                      </button>
                    ) : null}
                  </span>
                </div>

                {game.screenshotUrls.length ? (
                  <div data-game-el="1" data-game-shots="1" style={{ display: "flex", gap: 12, justifyContent: "flex-end", minWidth: 0 }}>
                    {game.screenshotUrls.map((url) => (
                      <span key={url} style={{ position: "relative", display: "block", width: "clamp(120px, 15vw, 200px)", aspectRatio: "16/10", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,244,234,0.22)", boxShadow: "0 24px 60px rgba(0,0,0,0.55)" }}>
                        <SafeImage src={url} sizes="200px" fallback={<span style={{ position: "absolute", inset: 0, background: "rgba(255,244,234,0.06)" }} />} />
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {/* Rail de jaquettes : le sélecteur */}
        <div ref={viewportRef} data-chips-viewport="1" style={{ position: "relative", zIndex: 3, flex: "0 0 auto", padding: "0 0 34px" }}>
          <div ref={trackRef} data-chips-track="1" style={{ display: "flex", gap: 14, padding: "0 30px", width: "max-content", transition: "transform 1s cubic-bezier(.16,1,.3,1)" }}>
            {games.map((game, index) => (
              <button
                key={`chip-${game.productId}`}
                ref={(el) => {
                  chipRefs.current[index] = el;
                }}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Afficher ${game.name}`}
                aria-current={index === active ? "true" : undefined}
                data-game-chip="1"
                style={{ cursor: "pointer", flex: "0 0 auto", width: "clamp(76px, 8vw, 104px)", padding: 0, border: 0, background: "transparent", display: "flex", flexDirection: "column", gap: 9, textAlign: "left", color: "#fff4ea", scrollSnapAlign: "center" }}
              >
                <span
                  data-chip-frame="1"
                  style={{ position: "relative", display: "block", aspectRatio: "3/4", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,244,234,0.2)", background: "rgba(255,244,234,0.05)", opacity: index === active ? 1 : 0.5, transition: "opacity .5s cubic-bezier(.16,1,.3,1)" }}
                >
                  <SafeImage
                    src={game.coverUrl}
                    sizes="104px"
                    fallback={<span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 6, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 8, lineHeight: 1.3, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8a6f63" }}>{game.name}</span>}
                  />
                </span>
                <span data-chip-label="1" style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#c9a695", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {game.tag}
                </span>
              </button>
            ))}
          </div>
          <div style={{ maxWidth: 1420, margin: "18px auto 0", padding: "0 30px" }}>
            <span style={{ display: "block", height: 2, background: "rgba(255,244,234,0.14)" }}>
              <span data-games-progress="1" style={{ display: "block", height: 2, width: "100%", background: "#ff7a3d", transform: "scaleX(0)", transformOrigin: "left" }} />
            </span>
          </div>
        </div>
      </div>

      <TrailerModal videoId={trailer.videoId} onClose={trailer.close} />
    </section>
  );
}
