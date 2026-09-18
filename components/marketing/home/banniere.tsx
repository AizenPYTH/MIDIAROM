import Image from "next/image";
import Link from "next/link";

/**
 * Une bannière éditoriale de l'accueil.
 *
 * Le handoff pose la règle qui gouverne tout le reste : les trois bannières
 * **ponctuent** la moitié boutique, à trois moments distincts, et jamais deux
 * ne se suivent. Une affiche isolée au milieu d'une page se lit comme un encart
 * acheté ; une affiche qui ouvre un rayon, interrompt un catalogue ou referme
 * une section se lit comme de l'éditorial.
 *
 * ── Pourquoi `contain` et non `cover` ───────────────────────────────────────
 *
 * Le handoff proposait `cover` avec un `object-position` réglé par bannière,
 * pour que le personnage reste dans le cadre au recadrage. On s'en écarte
 * délibérément : ces visuels portent un titre et une accroche, et un recadrage
 * — même bien réglé — finit toujours par manger un mot à une largeur qu'on n'a
 * pas testée.
 *
 * `contain` garantit que **l'image entière est visible à toutes les largeurs**,
 * quoi qu'il arrive. Aujourd'hui les trois fichiers font 2172×724, soit très
 * exactement le 3/1 du conteneur : `contain` et `cover` y rendent la même
 * image, au pixel près, sans bande vide. La différence n'apparaîtra que le jour
 * où une bannière arrivera dans un autre format — et ce jour-là elle sera
 * complète, entourée d'un peu de fond, plutôt que tronquée.
 */
export interface Banniere {
  /** Le fichier, dans `public/images/home/`. */
  src: string;
  /** Ce que l'image montre — lu par un lecteur d'écran, et si l'image manque. */
  alt: string;
  /** Le rayon que la bannière ouvre. */
  href: string;
  /**
   * La première bannière est visible sans défiler : elle se charge normalement.
   * Les deux autres attendent qu'on descende.
   */
  prioritaire?: boolean;
}

export function BanniereEditoriale({ src, alt, href, prioritaire = false, className = "" }: Banniere & { className?: string }) {
  return (
    <Link
      href={href}
      data-banniere="1"
      aria-label={alt}
      className={`group relative block overflow-hidden bg-ink-900 ${className}`}
      /*
        Le conteneur porte le ratio de l'image, pas l'inverse. À 3/1 et avec
        `contain`, il ne reste aucune bande : le cadre épouse le visuel.
      */
      style={{ aspectRatio: "3 / 1" }}
    >
      <Image
        src={src}
        alt=""
        fill
        /*
          `sizes` dit au navigateur la largeur d'affichage réelle : sans lui,
          Next sert le variant le plus large et le compresse pour rien, ou au
          contraire un variant trop petit qui rend flou. La bannière occupe
          toute la colonne du site, plafonnée à 1400 px.
        */
        sizes="(max-width: 1400px) 100vw, 1400px"
        quality={90}
        priority={prioritaire}
        loading={prioritaire ? undefined : "lazy"}
        // L'image entière, toujours. Voir l'en-tête du fichier.
        className="object-contain transition-transform duration-500 ease-out group-hover:scale-[1.018]"
      />
      {/*
        Le filet qui se déploie au survol — le même geste que les tuiles de
        rayon et les cartes d'univers. C'est ce qui rattache les bannières au
        site plutôt qu'à une campagne extérieure.
      */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100"
        style={{ background: "var(--brand-gradient)" }}
      />
    </Link>
  );
}

/**
 * Les trois bannières du handoff, dans leur ordre.
 *
 * L'ordre n'est pas décoratif : un action-RPG exigeant, un jeu de tir grand
 * public, un jeu de sport universel. L'audience s'élargit à mesure qu'on
 * descend, et l'on finit large juste avant d'inviter à venir en boutique.
 */
/*
  Note sur les fichiers d'origine : dans le dossier du handoff, `ban-eldenring.png`
  contient l'affiche Call of Duty et `ban-cod.png` contient celle d'Elden Ring —
  les deux noms sont intervertis. Vérifié à l'image, pas au nom de fichier. Les
  copies installées ici portent le nom de ce qu'elles montrent.
*/
export const BANNIERES = {
  eldenRing: {
    src: "/images/home/banniere-elden-ring.png",
    alt: "Elden Ring — le rayon jeux vidéo du 207 MÉDI@ROM",
    href: "/boutique?cat=jeux",
    prioritaire: false,
  },
  callOfDuty: {
    src: "/images/home/banniere-call-of-duty.png",
    alt: "Call of Duty sur Xbox — le rayon jeux vidéo du 207 MÉDI@ROM",
    href: "/boutique?cat=jeux&plateforme=Xbox*",
  },
  eaFc: {
    src: "/images/home/banniere-ea-fc.png",
    alt: "EA Sports FC — le rayon jeux vidéo du 207 MÉDI@ROM",
    href: "/boutique?cat=jeux",
  },
} satisfies Record<string, Banniere>;
