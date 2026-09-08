import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Tone = "info" | "success" | "warning" | "danger";

const styles: Record<Tone, { box: string; Icon: typeof Info }> = {
  info: { box: "border-info/25 bg-info-soft text-ink", Icon: Info },
  success: { box: "border-success/25 bg-success-soft text-ink", Icon: CheckCircle2 },
  warning: { box: "border-warning/30 bg-warning-soft text-ink", Icon: AlertTriangle },
  danger: { box: "border-danger/30 bg-danger-soft text-ink", Icon: XCircle },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const { box, Icon } = styles[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-md border px-4 py-3 text-sm", box, className)}>
      <Icon className="mt-0.5 h-4.5 w-4.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5", "text-ink-soft")}>{children}</div> : null}
      </div>
    </div>
  );
}
