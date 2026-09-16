"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils/cn";
import type { PricingMode } from "@/lib/shop/pricing-mode";

/**
 * Comment se facture une prestation : deux choix, et rien d'autre à comprendre.
 *
 *   ( ) Prix fixe            → un montant, affiché tel quel au client
 *   ( ) Nécessite un devis   → pas de montant, le diagnostic tranchera
 *
 * Le choix est explicite parce qu'il ne peut pas être deviné : le back-office
 * déduisait jusqu'ici « sur devis » d'un montant à zéro, ce qui interdisait
 * d'annoncer une prestation offerte et mélangeait « je ne facture rien » avec
 * « je ne sais pas encore combien ».
 *
 * Le champ montant disparaît en mode devis plutôt que de griser : un champ
 * désactivé n'est pas envoyé par le navigateur, et laisser un prix visible sous
 * une case « nécessite un devis » invite à le renseigner pour rien. Le mode, lui,
 * voyage toujours — c'est lui qui décide, côté serveur, de ce qui est enregistré.
 */
export function PricingModeField({
  initialMode,
  initialPriceEuros,
  layout = "stacked",
  priceName = "price",
  label = "Tarification",
  error,
}: {
  initialMode: PricingMode;
  initialPriceEuros: string;
  /** « inline » pour une ligne de tableau, « stacked » pour une fiche. */
  layout?: "inline" | "stacked";
  priceName?: string;
  label?: string;
  error?: string;
}) {
  const id = useId();
  const [mode, setMode] = useState<PricingMode>(initialMode);
  const inline = layout === "inline";

  const choix = (value: PricingMode, titre: string, aide: string) => {
    const actif = mode === value;
    return (
      <label
        key={value}
        className={cn(
          "flex min-h-[44px] cursor-pointer items-start gap-2.5 border px-3 py-2.5 transition-colors",
          inline ? "flex-1 items-center py-2" : "flex-1",
          actif ? "border-ink bg-surface-muted" : "border-border-strong hover:border-ink-muted",
        )}
      >
        {/* Groupe propre à cette instance : seul le champ caché ci-dessous
            porte le nom que le serveur lit, sinon les deux seraient postés. */}
        <input
          type="radio"
          name={`pricing_mode_ui_${id}`}
          value={value}
          defaultChecked={actif}
          onChange={() => setMode(value)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
        />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13.5px] font-semibold leading-tight text-ink">{titre}</span>
          {!inline ? <span className="text-[12px] leading-snug text-ink-muted">{aide}</span> : null}
        </span>
      </label>
    );
  };

  return (
    <span className="flex min-w-0 flex-col gap-2">
      {!inline ? <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted">{label}</span> : null}

      {/* Le nom réellement posté : un seul champ, quel que soit le rendu. */}
      <input type="hidden" name="pricing_mode" value={mode} />

      <span className={cn("flex min-w-0 gap-2", inline ? "flex-col sm:flex-row" : "flex-col sm:flex-row")}>
        {choix("FIXED", "Prix fixe", "Le client voit le montant et commande directement.")}
        {choix("QUOTE", "Nécessite un devis", "Le prix sera déterminé après diagnostic.")}
      </span>

      {mode === "FIXED" ? (
        <span className="flex min-w-0 items-center gap-2">
          {!inline ? <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted">Prix TTC</span> : null}
          <input
            name={priceName}
            defaultValue={initialPriceEuros}
            inputMode="decimal"
            required
            aria-label="Prix TTC en euros"
            className={cn(
              "min-h-[44px] w-full min-w-0 border border-border-strong bg-field px-3 py-2 text-right font-mono text-[16px] text-ink focus:border-accent focus:outline-none sm:text-[13px]",
              inline && "sm:max-w-[120px]",
              error && "border-danger",
            )}
          />
          <span className="font-mono text-[13px] text-ink-muted">€</span>
        </span>
      ) : (
        <span className="text-[12.5px] leading-snug text-ink-muted">Le prix sera déterminé après diagnostic. Aucun montant n&apos;est affiché au client.</span>
      )}

      {error ? <span className="text-[12px] text-danger">{error}</span> : null}
    </span>
  );
}
