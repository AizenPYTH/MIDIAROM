import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

/**
 * Boutons du handoff : blocs pleins ou contour 1 px, sans arrondi ni ombre.
 *  - primary  : encre (site) / bleu (admin) — hover orange (site) / papier (admin)
 *  - accent   : bleu réparation, hover encre / papier
 *  - sale     : orange vente, hover encre
 *  - outline  : contour 1 px encre
 *  - ghost    : texte seul
 *  - danger   : contour, texte danger
 *  - link     : lien souligné
 * Les tailles « mono » (sm) utilisent l'étiquette IBM Plex Mono majuscules.
 */
type Variant = "primary" | "accent" | "sale" | "secondary" | "outline" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg";

const base = "inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors disabled:opacity-60 disabled:pointer-events-none select-none cursor-pointer border";

const variants: Record<Variant, string> = {
  primary: "border-primary bg-primary text-primary-fg hover:bg-primary-hover hover:border-primary-hover hover:text-primary-fg",
  accent: "border-accent bg-accent text-white hover:bg-accent-hover hover:border-accent-hover hover:text-[var(--color-bg)]",
  sale: "border-sale bg-sale text-white hover:bg-sale-hover hover:border-sale-hover hover:text-[var(--color-bg)]",
  secondary: "border-border-strong bg-surface-muted text-ink hover:bg-surface-strong",
  outline: "border-border-strong bg-transparent text-ink hover:border-ink",
  ghost: "border-transparent bg-transparent text-ink-soft hover:text-ink",
  danger: "border-danger bg-transparent text-danger hover:bg-danger hover:text-white",
  link: "border-0 px-0 text-sale underline-offset-4 hover:underline h-auto",
};

const sizes: Record<Size, string> = {
  sm: "px-3.5 py-2.5 font-mono text-[12px] uppercase tracking-[0.06em]",
  md: "px-[22px] py-[14px] text-[15px] font-semibold",
  lg: "px-6 py-4 text-[15px] font-semibold",
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
  return (
    <span className={cn("inline-block h-3.5 w-3.5 border border-current border-r-transparent", className)} aria-hidden="true" style={{ animation: "spin 0.8s linear infinite" }} />
  );
}
