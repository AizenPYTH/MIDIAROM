"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useMobile } from "@/components/marketing/use-mobile";

export interface LienPied {
  label: string;
  href: string;
  external?: boolean;
}

/**
 * Une colonne du pied de page : ouverte sur grand écran, dépliable au doigt.
 *
 * Les trois colonnes s'empilaient sur téléphone : dix-sept liens de dix-sept
 * pixels de haut, neuf cent soixante pixels de tuile noire à traverser avant de
 * revenir en haut de page. Le handoff mobile les replie et porte chaque lien à
 * quarante-quatre pixels — on choisit son rayon, puis son lien, au lieu de viser
 * une ligne de texte parmi dix-sept.
 *
 * L'ouverture par défaut suit la même règle que les plateformes : le balisage
 * sort déplié du serveur, et seul le navigateur replie.
 */
export function FooterColumn({ titre, liens }: { titre: string; liens: LienPied[] }) {
  const id = useId();
  const mobile = useMobile();
  const [deplie, setDeplie] = useState(false);
  const ouvert = !mobile || deplie;

  const contenu = (
    <div id={id} hidden={!ouvert} className="flex flex-col lg:gap-2.5">
      {liens.map((lien) =>
        lien.external ? (
          <a
            key={lien.label}
            href={lien.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[44px] items-center text-[14px] transition-colors hover:text-on-dark active:text-on-dark lg:min-h-0"
          >
            {lien.label}
          </a>
        ) : (
          <Link
            key={lien.label}
            href={lien.href}
            className="flex min-h-[44px] items-center text-[14px] transition-colors hover:text-on-dark active:text-on-dark lg:min-h-0"
          >
            {lien.label}
          </Link>
        ),
      )}
    </div>
  );

  if (!mobile) {
    return (
      <div className="flex flex-col gap-2.5">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-on-dark-3">{titre}</span>
        {contenu}
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ borderTop: "1px solid rgba(242,242,244,0.16)" }}>
      <button
        type="button"
        onClick={() => setDeplie((v) => !v)}
        aria-expanded={ouvert}
        aria-controls={id}
        className="flex min-h-[48px] w-full cursor-pointer items-center justify-between gap-3 text-left font-mono text-[10.5px] uppercase tracking-[0.12em] text-on-dark-3 active:text-on-dark"
      >
        {titre}
        <span aria-hidden="true" className="block text-[15px] leading-none transition-transform duration-200" style={{ transform: ouvert ? "rotate(45deg)" : "none" }}>
          +
        </span>
      </button>
      {contenu}
    </div>
  );
}
