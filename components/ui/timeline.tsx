import { cn } from "@/lib/utils/cn";
import type { TimelineState } from "@/lib/orders/status";

/**
 * « Avancement » du handoff : segments égaux séparés de 2 px, mono 10 px
 * majuscules. Les segments atteints sont bleu / blanc, les suivants surface / muted.
 */
export function StatusTimeline({ steps, className }: { steps: { key: string; label: string; state: TimelineState }[]; className?: string }) {
  return (
    <ol className={cn("flex gap-[2px]", className)} aria-label="Avancement du dossier">
      {steps.map((step) => {
        const reached = step.state !== "todo";
        return (
          <li
            key={step.key}
            className={cn(
              "min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap px-1 py-[9px] text-center font-mono text-[10px] uppercase tracking-[0.04em]",
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
