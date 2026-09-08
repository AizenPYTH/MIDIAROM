import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { TimelineState } from "@/lib/orders/status";

export function StatusTimeline({ steps, className }: { steps: { key: string; label: string; state: TimelineState }[]; className?: string }) {
  return (
    <ol className={cn("grid grid-cols-4 gap-y-4 sm:grid-cols-8", className)} aria-label="Avancement du dossier">
      {steps.map((step, i) => (
        <li key={step.key} className="relative flex flex-col items-center text-center">
          {i < steps.length - 1 ? (
            <span
              className={cn(
                "absolute left-1/2 top-3.5 hidden h-0.5 w-full sm:block",
                step.state === "done" ? "bg-success" : "bg-border",
              )}
              aria-hidden="true"
            />
          ) : null}
          <span
            className={cn(
              "relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 bg-surface text-xs",
              step.state === "done" && "border-success bg-success text-white",
              step.state === "current" && "border-accent text-accent",
              step.state === "todo" && "border-border-strong text-ink-muted",
            )}
          >
            {step.state === "done" ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : step.state === "current" ? "●" : "○"}
          </span>
          <span className={cn("mt-1.5 text-[11px] leading-tight sm:text-xs", step.state === "todo" ? "text-ink-muted" : "text-ink")}>{step.label}</span>
          <span className="sr-only">
            {step.state === "done" ? " (terminé)" : step.state === "current" ? " (en cours)" : " (à venir)"}
          </span>
        </li>
      ))}
    </ol>
  );
}
