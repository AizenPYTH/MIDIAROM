import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function Stepper({
  steps,
  current,
  className,
}: {
  steps: readonly { key: string; label: string }[];
  current: number;
  className?: string;
}) {
  return (
    <nav aria-label="Progression" className={cn("w-full", className)}>
      <div className="sm:hidden">
        <p className="mb-1.5 text-sm font-medium text-ink-soft">
          Étape {current + 1} / {steps.length} — <span className="text-ink">{steps[current]?.label}</span>
        </p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={current + 1}>
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((current + 1) / steps.length) * 100}%` }} />
        </div>
      </div>
      <ol className="hidden items-center sm:flex">
        {steps.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={step.key} className="flex flex-1 items-center">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    done && "border-primary bg-primary text-white",
                    active && "border-accent bg-accent text-white",
                    !done && !active && "border-border-strong bg-surface text-ink-muted",
                  )}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : i + 1}
                </span>
                <span className={cn("hidden text-xs font-medium sm:block", active ? "text-ink" : "text-ink-muted")}>{step.label}</span>
              </div>
              {i < steps.length - 1 ? <div className={cn("mx-2 h-px flex-1", done ? "bg-primary" : "bg-border")} aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
