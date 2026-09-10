import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Champs du handoff : fond blanc (encre en admin), contour 1 px, padding 12 px,
 * aucun arrondi.
 *
 * La taille est de 16 px au téléphone et de 15 px à partir de `sm` : en dessous
 * de 16 px, iOS Safari zoome tout seul sur le champ dès la mise au point et ne
 * dézoome jamais. Le 15 px du handoff reste donc la valeur de bureau.
 */
const inputBase =
  "block w-full border border-border-strong bg-field px-3 py-3 text-[16px] text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none disabled:bg-surface-muted disabled:text-ink-muted aria-[invalid=true]:border-danger sm:text-[15px]";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block font-mono text-[11px] uppercase tracking-[0.08em] text-ink-soft", className)} {...props} />;
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(inputBase, className)} {...props} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(inputBase, "min-h-[96px] resize-y leading-normal", className)} {...props} />;
});

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(inputBase, "appearance-none bg-no-repeat pr-9", className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%238a8271' stroke-width='1.5' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundPosition: "right 0.75rem center",
      }}
      {...props}
    >
      {children}
    </select>
  );
});

/** Case à cocher contour encre, remplie bleu quand cochée (comme les lignes de
 *  prestation) : 18 × 18 au doigt, 16 × 16 à la souris. */
export function Checkbox({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" className={cn("h-[18px] w-[18px] shrink-0 appearance-none border border-ink bg-field checked:border-accent checked:bg-accent sm:h-4 sm:w-4", className)} {...props} />;
}

export interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

/** Label + control + hint + error, wired with aria attributes. */
export function Field({ label, htmlFor, hint, error, required, children, className }: FieldProps) {
  return (
    <div className={cn("w-full", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="ml-0.5 text-sale" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {children}
      {hint && !error ? (
        <p id={`${htmlFor}-hint`} className="mt-1 text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="mt-1 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="border border-danger bg-danger-soft px-4 py-3 text-sm text-danger">
      {message}
    </div>
  );
}

export function FormSuccess({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="status" className="border border-success bg-success-soft px-4 py-3 text-sm text-success">
      {message}
    </div>
  );
}
