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
      <p className="mb-2 text-sm font-medium text-ink-soft sm:hidden">
        Étape {current + 1} / {steps.length} — <span className="text-ink">{steps[current]?.label}</span>
      </p>
      <ol className="flex items-center gap-1 sm:gap-0">
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
