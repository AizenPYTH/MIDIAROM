"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormError } from "@/components/ui/form";
import { decideTradeInAction } from "@/app/(marketing)/reprise/actions";

/** Accepter / refuser l'offre depuis la page de suivi (jeton) ou l'espace client. */
export function TradeInDecision({ token }: { token: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const decide = async (accepted: boolean) => {
    if (!accepted && !window.confirm("Refuser l'offre ? Le lot reste à vous, sans frais.")) return;
    setBusy(true);
    setError(null);
    const result = await decideTradeInAction({ token, accepted, note });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    router.refresh();
  };
  return (
    <div className="flex flex-col gap-3">
      <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Remarque (facultatif)" aria-label="Remarque" className="min-h-[70px] w-full border border-border-strong bg-field p-3 text-[14px] text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none" />
      <FormError message={error} />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => decide(true)} className="flex-[1_1_150px] cursor-pointer bg-accent px-3 py-[13px] font-mono text-[12px] uppercase tracking-[0.06em] text-white hover:bg-ink-900 disabled:opacity-60">
          Accepter l&apos;offre
        </button>
        <button type="button" disabled={busy} onClick={() => decide(false)} className="cursor-pointer border border-border-strong px-[15px] py-[13px] font-mono text-[12px] uppercase tracking-[0.06em] text-ink-faint hover:border-ink disabled:opacity-60">
          Refuser
        </button>
      </div>
    </div>
  );
}
