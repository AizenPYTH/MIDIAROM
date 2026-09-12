import { cn } from "@/lib/utils/cn";

/**
 * Bandeau défilant des consoles prises en charge.
 *
 * La liste est dupliquée et translatée de 0 à -50 % : la seconde copie prend le
 * relais de la première sans rupture. Les losanges cyclent sur les quatre
 * accents de la charte.
 *
 * Les noms viennent du catalogue réel — rien n'est affiché que l'atelier ne
 * répare pas. La copie dupliquée est `aria-hidden` pour ne pas faire lire deux
 * fois la même liste.
 */
const DIAMOND_TONES = ["text-lime", "text-cyan", "text-violet", "text-rose"];

export function ConsoleMarquee({ items, className }: { items: string[]; className?: string }) {
  if (!items.length) return null;
  const run = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {items.map((label, i) => (
        <li key={`${label}-${i}`} className="flex items-center gap-6 whitespace-nowrap pr-6">
          <span className="font-display text-[18px] font-bold tracking-[-0.02em] text-ink-soft sm:text-[22px]">{label}</span>
          <span aria-hidden="true" className={cn("text-[13px]", DIAMOND_TONES[i % DIAMOND_TONES.length])}>
            ◆
          </span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className={cn("relative overflow-hidden border-y border-border py-5", className)}>
      <div className="anim-marquee flex w-max">
        {run(false)}
        {run(true)}
      </div>
      {/* Fondus latéraux : le bandeau naît et meurt dans le fond. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-bg to-transparent" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-bg to-transparent" />
    </div>
  );
}
