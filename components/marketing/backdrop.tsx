/**
 * Le fond de la page : du blanc.
 *
 * Il portait trois nuées colorées et un grain, hérités d'une charte sombre.
 * Cette direction-ci ne tient que par le blanc, le filet et l'espace : une
 * teinte de fond, même à 6 %, retire aux jaquettes et aux photos produit le
 * blanc franc sur lequel elles se détachent.
 *
 * Le composant reste — il est monté par la mise en page publique et sert de
 * fond explicite sous les sections — mais il ne peint plus qu'un aplat.
 */
export function Backdrop() {
  return <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-bg" />;
}

/**
 * Le point rouge du HUD : « diagnostic en cours », « atelier · sans son ».
 *
 * `steps(1)` et non une respiration : un témoin d'appareil s'allume et
 * s'éteint, il ne pulse pas. Carré, comme tout le reste de cette direction.
 */
export function PulseDot({ className }: { className?: string }) {
  return <span aria-hidden="true" data-hud-dot="1" className={`inline-block h-[6px] w-[6px] shrink-0 bg-brand ${className ?? ""}`} />;
}
