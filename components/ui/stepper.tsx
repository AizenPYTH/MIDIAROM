import { cn } from "@/lib/utils/cn";

/**
 * Progression du handoff : « Étape N / total » en mono à droite, rail 3 px
 * rempli en bleu réparation. Le libellé de l'étape courante est affiché à gauche.
 */
export function Stepper({
  steps,
  current,
  className,
  title = "Fiche de réparation",
}: {
  steps: readonly { key: string; label: string }[];
  current: number;
  className?: string;
  title?: string;
}) {
  const total = steps.length;
  const index = Math.min(Math.max(current, 0), total - 1);
  return (
    <nav aria-label="Progression" className={cn("w-full", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <strong className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink">
          {title}
          <span className="sr-only"> — {steps[index]?.label}</span>
        </strong>
        <span className="font-mono text-[12px] text-ink-muted">
          Étape {index + 1} / {total}
        </span>
      </div>
      <div className="mt-3 h-[3px] w-full bg-[rgba(20,18,15,0.12)]" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={index + 1} aria-valuetext={steps[index]?.label}>
        <div className="h-[3px] bg-accent" style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>
    </nav>
  );
}
