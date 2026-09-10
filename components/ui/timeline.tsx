import { cn } from "@/lib/utils/cn";
import type { TimelineState } from "@/lib/orders/status";

/**
 * « Avancement » du handoff : segments égaux séparés de 2 px, mono 10 px
 * majuscules. Les segments atteints sont bleu / blanc, les suivants surface / muted.
 *
 * Au téléphone, huit segments à se partager 360 px donneraient huit libellés
 * tronqués à trois lettres : la bande défile horizontalement et chaque segment
 * garde son intitulé entier (écran M6).
 */
export function StatusTimeline({ steps, className }: { steps: { key: string; label: string; state: TimelineState }[]; className?: string }) {
  return (
    <ol className={cn("scroll-strip gap-[2px] sm:flex", className)} aria-label="Avancement du dossier">
      {steps.map((step) => {
        const reached = step.state !== "todo";
        return (
          <li
            key={step.key}
            className={cn(
              "min-w-0 shrink-0 whitespace-nowrap px-[11px] py-[10px] sm:flex-1 sm:shrink sm:overflow-hidden sm:text-ellipsis sm:px-1 sm:py-[9px] text-center font-mono text-[10px] uppercase tracking-[0.04em]",
              reached ? "bg-accent text-white" : "bg-surface-muted text-ink-muted",
              step.state === "current" && "outline outline-1 -outline-offset-1 outline-white/40",
            )}
            aria-current={step.state === "current" ? "step" : undefined}
            title={step.label}
          >
            {step.label}
            <span className="sr-only">{step.state === "done" ? " (terminé)" : step.state === "current" ? " (en cours)" : " (à venir)"}</span>
          </li>
        );
      })}
    </ol>
  );
}
