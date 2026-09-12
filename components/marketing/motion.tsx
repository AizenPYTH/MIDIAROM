"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

/** La courbe standard de la charte. */
const EASE = "cubic-bezier(.16,1,.3,1)";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Révélations au défilement.
 *
 * Le handoff insiste sur le piège rencontré en prototype : un élément laissé à
 * `opacity: 0` en attendant un observateur reste invisible pour toujours si le
 * script ne répond pas. Trois précautions ici :
 *   1. la translucidité n'est posée en CSS que sous `[data-reveal-armed]`, donc
 *      seulement une fois ce composant monté — sans JavaScript, tout est visible ;
 *   2. l'observateur interroge le `document` entier, pas une référence racine,
 *      et se réarme à chaque navigation ;
 *   3. ce qui est déjà à l'écran est révélé immédiatement.
 */
export function RevealArmer() {
  useEffect(() => {
    const root = document.documentElement;
    if (prefersReducedMotion()) {
      document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
      return;
    }
    root.setAttribute("data-reveal-armed", "");

    const show = (el: Element, delay = 0) => {
      (el as HTMLElement).style.transitionDelay = `${delay}ms`;
      el.classList.add("is-visible");
    };

    const observer = new IntersectionObserver(
      (entries) => {
        // Cascade de 70 ms entre les éléments d'un même groupe qui entrent ensemble.
        entries
          .filter((e) => e.isIntersecting)
          .forEach((e, i) => {
            show(e.target, i * 70);
            observer.unobserve(e.target);
          });
      },
      { threshold: 0.12, rootMargin: "0px 0px -5% 0px" },
    );

    const attach = () => {
      document.querySelectorAll<HTMLElement>(".reveal:not(.is-visible)").forEach((el) => {
        const box = el.getBoundingClientRect();
        // Déjà dans l'écran au chargement : on n'attend pas l'observateur.
        if (box.top < window.innerHeight && box.bottom > 0) show(el);
        else observer.observe(el);
      });
    };

    attach();
    // Les sections rendues après coup (données chargées, étape de formulaire
    // changée) doivent être prises en compte à leur tour.
    const mutation = new MutationObserver(attach);
    mutation.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutation.disconnect();
      root.removeAttribute("data-reveal-armed");
    };
  }, []);
  return null;
}

/**
 * Halo qui suit le curseur dans le hero : un disque lime très diffus, invisible
 * tant que la souris n'est pas entrée. Sans objet au doigt — il ne s'active
 * qu'au survol d'un vrai pointeur.
 */
export function CursorHalo({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const host = ref.current?.parentElement;
    if (!host || prefersReducedMotion() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const move = (e: MouseEvent) => {
      const box = host.getBoundingClientRect();
      if (ref.current) {
        ref.current.style.left = `${e.clientX - box.left}px`;
        ref.current.style.top = `${e.clientY - box.top}px`;
      }
    };
    const enter = () => setOn(true);
    const leave = () => setOn(false);
    host.addEventListener("mousemove", move);
    host.addEventListener("mouseenter", enter);
    host.addEventListener("mouseleave", leave);
    return () => {
      host.removeEventListener("mousemove", move);
      host.removeEventListener("mouseenter", enter);
      host.removeEventListener("mouseleave", leave);
    };
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn("pointer-events-none absolute h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-500", className)}
      style={{ background: "radial-gradient(circle, rgba(216,255,62,0.16), transparent 62%)", opacity: on ? 1 : 0 }}
    />
  );
}

/** Panneau qui s'incline légèrement vers le curseur. Inactif au doigt. */
export function Tilt({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const move = (e: MouseEvent) => {
      const box = el.getBoundingClientRect();
      const x = (e.clientX - box.left) / box.width - 0.5;
      const y = (e.clientY - box.top) / box.height - 0.5;
      el.style.transform = `rotateY(${x * 7}deg) rotateX(${-y * 5}deg)`;
    };
    const reset = () => {
      el.style.transform = "rotateY(0deg) rotateX(0deg)";
    };
    el.addEventListener("mousemove", move);
    el.addEventListener("mouseleave", reset);
    return () => {
      el.removeEventListener("mousemove", move);
      el.removeEventListener("mouseleave", reset);
    };
  }, []);
  return (
    <div style={{ perspective: 1400 }}>
      <div ref={ref} className={className} style={{ transition: `transform .5s ${EASE}` }}>
        {children}
      </div>
    </div>
  );
}

/** Bouton magnétique : il vient légèrement à la rencontre du curseur. */
export function Magnetic({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const move = (e: MouseEvent) => {
      const box = el.getBoundingClientRect();
      const dx = e.clientX - (box.left + box.width / 2);
      const dy = e.clientY - (box.top + box.height / 2);
      el.style.transform = `translate(${dx * 0.16}px, ${dy * 0.22}px) scale(1.03)`;
    };
    const reset = () => {
      el.style.transform = "translate(0,0) scale(1)";
    };
    el.addEventListener("mousemove", move);
    el.addEventListener("mouseleave", reset);
    return () => {
      el.removeEventListener("mousemove", move);
      el.removeEventListener("mouseleave", reset);
    };
  }, []);
  return (
    <span ref={ref} className={cn("inline-block", className)} style={{ transition: `transform .3s ${EASE}` }}>
      {children}
    </span>
  );
}

/**
 * Compteur qui s'incrémente à l'entrée dans l'écran.
 *
 * La valeur finale est rendue côté serveur : si le script ne tourne pas, le
 * chiffre juste s'affiche sans s'animer.
 */
export function Counter({ value, decimals = 0, suffix = "", className }: { value: number; decimals?: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const k = Math.min(1, (now - start) / 1100);
          setShown(value * (1 - Math.pow(1 - k, 3)));
          if (k < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.3 },
    );
    setShown(0);
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);
  return (
    <span ref={ref} className={className}>
      {shown.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

/** Anneau de progression du parcours de devis : cercle SVG r=44. */
export function ProgressRing({ step, total, size = 64, className }: { step: number; total: number; size?: number; className?: string }) {
  const circumference = 276; // 2πr, r = 44
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={cn("shrink-0", className)} role="img" aria-label={`Étape ${step} sur ${total}`}>
      <circle cx="50" cy="50" r="44" fill="none" stroke="var(--stroke)" strokeWidth="4" />
      <circle
        cx="50"
        cy="50"
        r="44"
        fill="none"
        stroke="var(--lime)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference - circumference * (step / total)}
        transform="rotate(-90 50 50)"
        style={{ transition: `stroke-dashoffset .7s ${EASE}` }}
      />
      <text x="50" y="56" textAnchor="middle" fill="var(--text)" style={{ font: "500 26px var(--font-mono)" }}>
        {step}/{total}
      </text>
    </svg>
  );
}
