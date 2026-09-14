/**
 * Fond de la charte claire : un lavis très pâle derrière la page.
 *
 * Il portait deux nuées saturées à plus de 50 % d'opacité, pensées pour un fond
 * noir. Sur du blanc, elles teintaient toute la page et les cartes produits
 * perdaient leur blanc. Elles restent, mais à l'état de nuance — assez pour que
 * la page ne soit pas un aplat mort, jamais assez pour concurrencer une
 * jaquette.
 *
 * `fixed` plutôt qu'`absolute` : les nuées restent en place pendant le
 * défilement au lieu de disparaître après le premier écran. Purement décoratif,
 * donc `aria-hidden` et `pointer-events-none` — rien ici ne doit intercepter un
 * clic ni être annoncé par un lecteur d'écran.
 *
 * Aucun script : les dérives sont des animations CSS, et
 * `prefers-reduced-motion` les fige sans rien masquer.
 */

/** Grain : feTurbulence figé en data-URI, pour n'ajouter aucune requête. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

export function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg">
      <div
        className="anim-drift1 absolute -left-[18vw] -top-[22vh] h-[62vh] w-[62vw] rounded-full opacity-100"
        style={{ background: "radial-gradient(circle, rgba(91,61,245,0.10), transparent 62%)", filter: "blur(56px)" }}
      />
      <div
        className="anim-drift2 absolute -right-[14vw] top-[6vh] h-[54vh] w-[54vw] rounded-full opacity-100"
        style={{ background: "radial-gradient(circle, rgba(14,116,144,0.08), transparent 64%)", filter: "blur(48px)" }}
      />
      <div
        className="anim-drift1 absolute bottom-[-18vh] left-[22vw] h-[50vh] w-[50vw] rounded-full opacity-[0.6]"
        style={{ background: "radial-gradient(circle, rgba(232,89,12,0.06), transparent 66%)", filter: "blur(52px)", animationDuration: "38s", animationDirection: "reverse" }}
      />
      <div className="absolute inset-0 opacity-[0.025] mix-blend-multiply" style={{ backgroundImage: GRAIN, backgroundSize: "140px 140px" }} />
    </div>
  );
}

/** Point lime qui bat : « atelier ouvert ». */
export function PulseDot({ className }: { className?: string }) {
  return <span aria-hidden="true" className={`anim-pulse inline-block h-[7px] w-[7px] shrink-0 rounded-full bg-sale ${className ?? ""}`} />;
}
