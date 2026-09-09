import * as React from "react";
import { cn } from "@/lib/utils/cn";

type Tone = "info" | "success" | "warning" | "danger";

/** Encadré plat du handoff : filet 1 px + fond ton sur ton, étiquette mono en titre. */
const styles: Record<Tone, string> = {
  info: "border-info bg-info-soft",
  success: "border-success bg-success-soft",
  warning: "border-warning bg-warning-soft",
  danger: "border-danger bg-danger-soft",
};

const titles: Record<Tone, string> = {
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export function Alert({ tone = "info", title, children, className }: { tone?: Tone; title?: string; children?: React.ReactNode; className?: string }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("border px-4 py-3 text-sm text-ink", styles[tone], className)}>
      {title ? <p className={cn("font-mono text-[11px] uppercase tracking-[0.08em]", titles[tone])}>{title}</p> : null}
      {children ? <div className={cn(title && "mt-1", "text-ink-soft")}>{children}</div> : null}
    </div>
  );
}
