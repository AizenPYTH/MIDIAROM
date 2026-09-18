import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";

/**
 * « Nos univers » — deux rails, neuf portes.
 *
 * Le handoff écarte la grille unique de logos mélangés : mettre PlayStation et
 * One Piece dans la même rangée met sur le même plan une plateforme qu'on
 * répare et une licence qu'on collectionne. D'où deux groupes étiquetés.
 *
 * Neuf cartes, pas douze. Douze est le nombre confortable pour une grille —
 * c'est précisément le problème : il aurait fallu en inventer trois.
 */
export interface CarteUnivers {
  nom: string;
  legende: string;
  href: string;
  /** Le fichier attendu dans `public/images/univers/`, sans extension. */
  fichier: string;
}

/*
  ── Les destinations, et pourquoi elles marchent déjà ────────────────────────

  Le handoff annonçait qu'aucune de ces neuf adresses n'existait, et que les
  cinq licences demandaient une colonne supplémentaire. Ce n'est plus le cas :
  `products.platform` porte une **plateforme** dans les rayons Jeux et Consoles,
  et une **licence** dans le rayon Figurines — c'est la distinction qu'on a déjà
  levée dans le filtre de la boutique.

  Les valeurs réelles en base sont fines : « PlayStation 4 » et « PlayStation 5 »
  et non « PlayStation », « Dragon Ball Z » et « Dragon Ball Super ». Une carte
  de famille couvre donc une préfixe, écrit `*` dans l'adresse et traduit en
  motif par le filtre. C'est deux lignes dans `lib/shop/catalog.ts`, pas un
  modèle de données.

  « Rétro » est le seul cas qui ne se laisse pas préfixer — N64 et Super
  Nintendo n'ont pas de racine commune — et c'est aussi le seul qui dispose
  déjà de son propre filtre.
*/
export const PLATEFORMES: CarteUnivers[] = [
  { nom: "PlayStation", legende: "PS5 · PS4 · rétro", href: "/boutique?plateforme=PlayStation*", fichier: "playstation" },
  { nom: "Nintendo", legende: "Switch · Switch 2 · rétro", href: "/boutique?plateforme=Nintendo*", fichier: "nintendo" },
  { nom: "Xbox", legende: "Series · One", href: "/boutique?plateforme=Xbox*", fichier: "xbox" },
  { nom: "Rétro", legende: "N64 · SNES · Mega Drive", href: "/boutique?retro=1", fichier: "retro" },
];

export const LICENCES: CarteUnivers[] = [
  { nom: "One Piece", legende: "Figurines", href: "/boutique?cat=figurines&plateforme=One Piece", fichier: "one-piece" },
  { nom: "Naruto", legende: "Figurines", href: "/boutique?cat=figurines&plateforme=Naruto*", fichier: "naruto" },
  { nom: "Dragon Ball", legende: "Figurines", href: "/boutique?cat=figurines&plateforme=Dragon Ball*", fichier: "dragon-ball" },
  { nom: "Jujutsu Kaisen", legende: "Figurines", href: "/boutique?cat=figurines&plateforme=Jujutsu Kaisen", fichier: "jujutsu-kaisen" },
  { nom: "Demon Slayer", legende: "Figurines", href: "/boutique?cat=figurines&plateforme=Demon Slayer", fichier: "demon-slayer" },
];

const EXTENSIONS = [".svg", ".png", ".webp", ".jpg"];

/**
 * Le logo de la carte, s'il a été déposé.
 *
 * Aucun logo n'est produit ici, et aucun n'est allé le chercher ailleurs : on
 * regarde si le fichier existe dans `public/images/univers/`, et on l'utilise.
 * Tant qu'il n'y est pas, la carte porte le nom de la marque en typographie —
 * exactement ce que fait la maquette du handoff, qui note qu'elle ne peut pas
 * produire de logos non plus.
 *
 * Le jour où les fichiers sont déposés, les logos apparaissent sans toucher au
 * code : la carte, sa taille et son comportement ne changent pas.
 */
function logoDe(fichier: string): string | null {
  for (const ext of EXTENSIONS) {
    const relatif = `/images/univers/${fichier}${ext}`;
    if (existsSync(path.join(process.cwd(), "public", relatif))) return relatif;
  }
  return null;
}

function Carte({ carte }: { carte: CarteUnivers }) {
  const logo = logoDe(carte.fichier);
  return (
    <Link
      href={carte.href}
      data-uni="1"
      className="group flex shrink-0 grow basis-[176px] flex-col items-center justify-center gap-2 border border-border-strong bg-white px-3 py-3.5 text-center transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-brand active:bg-[#f0f4fb]"
      style={{ boxSizing: "border-box", minHeight: "112px", scrollSnapAlign: "start" }}
    >
      {logo ? (
        /*
          Hauteur bornée, largeur bornée, `contain` : un logo large et un logo
          haut occupent la même surface optique, quelles que soient les
          dimensions du fichier déposé. Rien n'est jamais étiré.
        */
        <span className="relative block h-[44px] w-[62%]">
          <Image src={logo} alt={carte.nom} fill sizes="240px" className="object-contain opacity-[0.82] transition-opacity duration-200 group-hover:opacity-100" />
        </span>
      ) : (
        <span className="text-[17px] font-extrabold tracking-[-0.025em] text-ink opacity-[0.82] transition-opacity duration-200 group-hover:opacity-100">{carte.nom}</span>
      )}
      <span className="font-mono text-[10.5px] uppercase tracking-[0.09em] text-ink-faint">{carte.legende}</span>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100"
        style={{ background: "var(--brand-gradient)" }}
      />
    </Link>
  );
}

/**
 * Un rail : une seule ligne, toujours.
 *
 * `flex-wrap: nowrap` et `flex: 1 0 176px` — base 176 px, grandit pour remplir
 * la ligne, **ne rétrécit jamais**. Au large, quatre cartes se partagent la
 * largeur ; au étroit, elles gardent leurs 176 px et le rail se met à défiler
 * plutôt que de passer à la ligne. C'est la différence entre un rail et une
 * grille qui s'effondre en colonne.
 *
 * `box-sizing: border-box` est posé sur la carte et non ici : `flex-basis`
 * porte sur la boîte de contenu, donc sans lui le rembourrage et le filet
 * s'ajoutent aux 176 px déclarés — la carte en mesure 202, et le rail déborde.
 */
function Rail({ cartes, label }: { cartes: CarteUnivers[]; label: string }) {
  return (
    <div
      data-uni-rail="1"
      data-rail="1"
      role="list"
      aria-label={label}
      className="flex flex-nowrap gap-2.5 overflow-x-auto"
      style={{ scrollSnapType: "x proximity", WebkitOverflowScrolling: "touch" }}
    >
      {cartes.map((c) => (
        <span key={c.nom} role="listitem" className="relative flex shrink-0 grow basis-[176px] overflow-hidden">
          <Carte carte={c} />
        </span>
      ))}
    </div>
  );
}

export function UniversV9() {
  return (
    <section id="univers" className="mx-auto w-full max-w-[var(--page-max)] px-[clamp(16px,4.08vw,51px)] pt-[clamp(40px,5.36vw,67px)]">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-brand">Le catalogue par univers</span>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
      <h2 className="mt-3 text-center text-[clamp(27px,3.2vw,40px)] font-extrabold leading-[0.98] tracking-[-0.042em] text-ink">Nos univers</h2>
      <p className="mesure mx-auto mt-2.5 text-center text-[16.5px] leading-[1.5] text-ink-soft">Ce qu&apos;on répare, ce qu&apos;on vend, ce qu&apos;on collectionne.</p>

      <div className="mt-[clamp(20px,2.4vw,34px)]">
        <span className="mb-2.5 block font-mono text-[10.5px] uppercase tracking-[0.13em] text-ink-faint">Plateformes</span>
        <Rail cartes={PLATEFORMES} label="Plateformes" />
      </div>

      {/* Le filet qui sépare les deux groupes : une plateforme qu'on répare
          n'est pas une licence qu'on collectionne. */}
      <div className="mt-[26px] border-t border-border pt-[26px]">
        <span className="mb-2.5 block font-mono text-[10.5px] uppercase tracking-[0.13em] text-ink-faint">Univers manga &amp; anime</span>
        <Rail cartes={LICENCES} label="Univers manga et anime" />
      </div>
    </section>
  );
}
