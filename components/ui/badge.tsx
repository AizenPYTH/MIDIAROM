import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Badge de statut : mono 10.5 px majuscules, pastille arrondie sur fond ton
 * sur ton.
 * Tons : ambre (nouveau, devis envoyé, à préparer), bleu (reçu, diagnostic,
 * estimé), vert (en atelier, prêt, payé, accepté), neutre (expédié, en attente),
 * encre (état produit), danger (rupture, refus, litige).
 */
export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger" | "primary" | "ink";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-strong text-ink-soft",
  info: "bg-info-soft text-info",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  primary: "bg-accent-soft text-info",
  ink: "bg-paper text-ink-900",
};

export function Badge({ tone = "neutral", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-[10px] py-[4px] font-mono text-[10.5px] uppercase tracking-[0.1em]", tones[tone], className)} {...props} />;
}
