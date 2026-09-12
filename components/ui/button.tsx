import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

/**
 * Boutons de la charte v4 : pilules.
 *  - primary  : dégradé violet → cyan sur texte sombre, lueur violette, reflet balayant
 *  - accent   : aplat cyan, texte sombre
 *  - sale     : aplat lime, texte sombre
 *  - light    : pilule claire (le CTA de l'en-tête)
 *  - outline  : contour clair sur fond transparent, survol lime
 *  - ghost    : texte seul
 *  - danger   : contour danger
 *  - link     : lien souligné
 *
 * Sur un aplat lime ou cyan, le texte repasse en fond (`--color-on-accent`) :
 * c'est le seul couple lisible de la charte.
 */
type Variant = "primary" | "accent" | "sale" | "light" | "secondary" | "outline" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border transition-all duration-300 ease-[cubic-bezier(.16,1,.3,1)] disabled:opacity-60 disabled:pointer-events-none select-none cursor-pointer";

const variants: Record<Variant, string> = {
  primary: "btn-gradient border-transparent font-semibold hover:brightness-110",
  accent: "border-accent bg-accent text-[var(--color-on-accent)] hover:brightness-110",
  sale: "border-sale bg-sale text-[var(--color-on-accent)] hover:brightness-110",
  light: "border-transparent bg-paper text-ink-900 hover:brightness-95",
  secondary: "border-border-strong bg-surface text-ink hover:bg-surface-strong",
  outline: "border-border-strong bg-transparent text-ink hover:border-sale hover:text-sale",
  ghost: "border-transparent bg-transparent text-ink-soft hover:text-ink",
  danger: "border-danger bg-transparent text-danger hover:bg-danger hover:text-[var(--color-on-accent)]",
  link: "border-0 px-0 text-sale underline-offset-4 hover:underline h-auto rounded-none",
};

const sizes: Record<Size, string> = {
  // 13 px de padding vertical au téléphone : la cible tactile atteint 44 px.
  sm: "px-4 py-[13px] font-mono text-[11.5px] uppercase tracking-[0.12em] sm:py-2.5",
  md: "px-[22px] py-[15px] text-[15px] font-semibold sm:py-3.5",
  lg: "px-7 py-[17px] text-[16px] font-semibold",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({ className, variant = "primary", size = "md", loading, fullWidth, children, disabled, ...props }: ButtonProps) {
  return (
    <button className={cn(base, variants[variant], sizes[size], fullWidth && "w-full", className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export interface ButtonLinkProps extends React.ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

export function ButtonLink({ className, variant = "primary", size = "md", fullWidth, ...props }: ButtonLinkProps) {
  return <Link className={cn(base, variants[variant], sizes[size], fullWidth && "w-full", className)} {...props} />;
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn("inline-block h-3.5 w-3.5 rounded-full border border-current border-r-transparent", className)} aria-hidden="true" style={{ animation: "spin 0.8s linear infinite" }} />;
}
