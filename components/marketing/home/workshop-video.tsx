"use client";

import { useEffect, useRef, useState } from "react";

/**
 * La vidéo d'atelier : 16/9, muette, en boucle, jamais bloquante.
 *
 * Trois règles portent toute la conception de ce composant.
 *
 * 1. **Rien ne se télécharge tant que la section n'est pas atteinte.**
 *    `preload="none"`, et la source n'est écrite dans le DOM qu'au premier
 *    déclenchement de lecture. Une vidéo de 6 Mo posée dans le HTML se
 *    téléchargerait sur mobile avant que le visiteur l'ait vue.
 * 2. **Elle s'arrête quand elle sort de l'écran.** Un `IntersectionObserver` à
 *    seuil 0,4 : une vidéo qui tourne trois écrans plus haut consomme de la
 *    batterie pour personne.
 * 3. **Elle n'est jamais bloquante.** Sans `src`, le cadre reste l'image
 *    d'attente et le bouton disparaît ; sans mouvement autorisé, rien ne part
 *    tout seul et seul le bouton déclenche.
 *
 * Elle est **toujours muette** — `muted` dans le markup, et aucune commande de
 * son : c'est ce qui autorise la lecture automatique, et ce qui fait qu'une
 * page d'accueil ne prend pas la parole sans qu'on le lui demande.
 */
export function WorkshopVideo({ src, poster, children }: { src?: string; poster?: string; children: React.ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  /** La source n'existe qu'après le premier ordre de lecture. */
  const [armed, setArmed] = useState(false);

  // Lecture à l'entrée dans l'écran, pause à la sortie. Sans `src`, rien à
  // observer ; sans mouvement autorisé, la lecture reste manuelle.
  useEffect(() => {
    const cadre = frame.current;
    if (!src || !cadre) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          setArmed(true);
          // La source vient d'être demandée : elle n'est posée qu'au rendu
          // suivant, d'où la lecture différée d'une image.
          requestAnimationFrame(() => {
            video.current?.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
          });
        } else {
          video.current?.pause();
          setPlaying(false);
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(cadre);
    return () => observer.disconnect();
  }, [src]);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      setArmed(true);
      requestAnimationFrame(() => {
        v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      });
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  return (
    <div ref={frame} data-rise="1" className="relative aspect-video overflow-hidden border border-border bg-ink">
      {/* L'image d'attente. Sans vidéo fournie, la section reste cette image —
          c'est le repli, pas un état dégradé. */}
      <span className="absolute inset-0">{children}</span>

      {src ? (
        <video
          ref={video}
          muted
          loop
          playsInline
          preload="none"
          poster={poster}
          src={armed ? src : undefined}
          aria-label="Vue de l'atelier, sans son"
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
          style={{ opacity: playing ? 1 : 0 }}
        />
      ) : null}

      <span className="pointer-events-none absolute left-3.5 top-3.5 flex items-center gap-2 bg-ink/90 px-[11px] py-[7px]">
        <span data-hud-dot="1" aria-hidden="true" className="block h-1.5 w-1.5 bg-brand" />
        <span className="font-mono text-[10.5px] uppercase tracking-[0.09em] text-on-dark">Atelier · sans son</span>
      </span>

      {src ? (
        <button
          type="button"
          onClick={toggle}
          aria-pressed={playing}
          className="absolute bottom-3.5 right-3.5 flex cursor-pointer items-center gap-2.5 border-0 bg-white px-[17px] py-3 font-mono text-[11px] font-medium uppercase tracking-[0.07em] text-ink transition-colors hover:bg-brand hover:text-white"
        >
          <span aria-hidden="true" className="block h-2 w-2 bg-current" />
          {playing ? "Pause" : "Lire"}
        </button>
      ) : null}
    </div>
  );
}
