"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Bande-annonce YouTube. L'iframe n'existe qu'à l'ouverture : une page qui
 * porte cinq jeux ne doit pas charger cinq lecteurs.
 *
 * Rien n'est téléchargé ni réhébergé — c'est le lecteur de YouTube qui joue la
 * vidéo, depuis son domaine.
 */
export function useTrailer() {
  const [videoId, setVideoId] = useState<string | null>(null);
  const close = useCallback(() => setVideoId(null), []);

  useEffect(() => {
    if (!videoId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    // Le fond ne doit pas défiler derrière la modale.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [videoId, close]);

  return { videoId, open: setVideoId, close };
}

export function TrailerModal({ videoId, onClose }: { videoId: string | null; onClose: () => void }) {
  if (!videoId) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bande-annonce"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 120, display: "flex", alignItems: "center",
        justifyContent: "center", padding: 30, background: "rgba(7,6,10,0.9)", backdropFilter: "blur(12px)",
      }}
    >
      <button
        type="button"
        onClick={onClose}
        style={{
          position: "absolute", top: 24, right: 26, cursor: "pointer", background: "transparent",
          border: "1px solid rgba(255,244,234,0.3)", borderRadius: 999, padding: "13px 20px",
          fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.12em",
          textTransform: "uppercase", color: "#fff4ea",
        }}
      >
        Fermer
      </button>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(100%, 1100px)", aspectRatio: "16/9", borderRadius: 20, overflow: "hidden",
          border: "1px solid rgba(255,244,234,0.18)", background: "#000",
        }}
      >
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`}
          title="Bande-annonce"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ width: "100%", height: "100%", border: 0 }}
        />
      </div>
    </div>
  );
}
