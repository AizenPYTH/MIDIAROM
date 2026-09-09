"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, FormSuccess, Input, Select, Textarea } from "@/components/ui/form";
import { ORDER_STATUS_LABELS, allowedTransitions, type OrderStatus, type UserRole, canRoleTransition, DIAGNOSTIC_OUTCOME_LABELS } from "@/lib/orders/status";
import {
  addInternalNoteAction,
  addPartAction,
  addWorkLogAction,
  changeStatusAction,
  createQuoteAction,
  createReturnLabelAction,
  lookupForReceptionAction,
  markShippedAction,
  recordShipmentAction,
  refundPaymentAction,
  saveDiagnosticAction,
  saveReceptionAction,
  saveTestResultsAction,
  sendQuoteAction,
  type ActionResult,
} from "@/app/admin/actions/orders";
import { formatPrice } from "@/lib/utils/format";

function useRefresh(state: ActionResult | null) {
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);
}

function Feedback({ state }: { state: ActionResult | null }) {
  return (
    <>
      <FormError message={state && !state.ok ? state.error : null} />
      <FormSuccess message={state?.ok ? (state.message ?? null) : null} />
    </>
  );
}

export function ReceptionLookupForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(lookupForReceptionAction, null);
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <Field label="Numéro de dossier ou de suivi" htmlFor="query" className="flex-1">
        <Input id="query" name="query" autoFocus autoComplete="off" placeholder="REP-000152 ou numéro de suivi" className="font-mono text-lg" />
      </Field>
      <Button type="submit" loading={pending} size="lg">
        Ouvrir la réception
      </Button>
      <div className="sm:basis-full">
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function StatusForm({ orderId, current, role }: { orderId: string; current: OrderStatus; role: UserRole }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(changeStatusAction, null);
  useRefresh(state);
  const targets = allowedTransitions(current).filter((t) => canRoleTransition(role, current, t));
  if (!targets.length) return <p className="text-sm text-ink-muted">Aucune transition disponible depuis ce statut.</p>;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="order_id" value={orderId} />
      <Field label="Nouveau statut" htmlFor="status">
        <Select id="status" name="status" defaultValue={targets[0]}>
          {targets.map((t) => (
            <option key={t} value={t}>
              {ORDER_STATUS_LABELS[t]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Message visible par le client (facultatif)" htmlFor="public_note">
        <Input id="public_note" name="public_note" maxLength={300} />
      </Field>
      <Field label="Raison interne (facultatif)" htmlFor="reason">
        <Input id="reason" name="reason" maxLength={300} />
      </Field>
      <Feedback state={state} />
      <Button type="submit" size="sm" loading={pending}>
        Changer le statut
      </Button>
    </form>
  );
}

export function NoteForm({ orderId, compact }: { orderId: string; compact?: boolean }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addInternalNoteAction, null);
  useRefresh(state);
  return (
    <form action={action} className="flex flex-col gap-2" key={state?.ok ? "sent" : "draft"}>
      <input type="hidden" name="order_id" value={orderId} />
      <Textarea name="body" required minLength={2} placeholder={compact ? "Note d'atelier interne — pièces commandées, mesures, tests effectués…" : "Note interne ou message au client…"} aria-label="Message" className={compact ? "min-h-[80px] text-[14px]" : undefined} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-[13px] text-ink-soft">
          <Checkbox name="internal" defaultChecked /> Note interne (non visible par le client)
        </label>
        <Button type="submit" size="sm" variant="outline" loading={pending}>
          Enregistrer la note
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function ReceptionForm({ orderId, report, declaredSerial }: { orderId: string; report: { package_condition: string | null; exterior_condition: string | null; serial_number: string | null; accessories: string[]; visible_damage: string | null; initial_test: string | null; comments: string | null; tracking_number_scanned: string | null } | null; declaredSerial: string | null }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveReceptionAction, null);
  useRefresh(state);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="order_id" value={orderId} />
      <Field label="Numéro de suivi scanné" htmlFor="tracking_number_scanned">
        <Input id="tracking_number_scanned" name="tracking_number_scanned" defaultValue={report?.tracking_number_scanned ?? ""} className="font-mono" />
      </Field>
      <Field label="Numéro de série" htmlFor="serial_number" hint={declaredSerial ? `Déclaré par le client : ${declaredSerial}` : undefined}>
        <Input id="serial_number" name="serial_number" defaultValue={report?.serial_number ?? declaredSerial ?? ""} className="font-mono" />
      </Field>
      <Field label="État du colis" htmlFor="package_condition">
        <Textarea id="package_condition" name="package_condition" defaultValue={report?.package_condition ?? ""} placeholder="Carton intact, calage correct…" className="min-h-[72px]" />
      </Field>
      <Field label="État extérieur de la console" htmlFor="exterior_condition">
        <Textarea id="exterior_condition" name="exterior_condition" defaultValue={report?.exterior_condition ?? ""} placeholder="Rayures, traces d'ouverture, vis manquantes…" className="min-h-[72px]" />
      </Field>
      <Field label="Accessoires reçus" htmlFor="accessories" hint="Séparés par des virgules">
        <Input id="accessories" name="accessories" defaultValue={report?.accessories.join(", ") ?? ""} placeholder="Câble HDMI, manette…" />
      </Field>
      <Field label="Dommages visibles" htmlFor="visible_damage">
        <Input id="visible_damage" name="visible_damage" defaultValue={report?.visible_damage ?? ""} />
      </Field>
      <Field label="Test initial" htmlFor="initial_test" className="sm:col-span-2">
        <Textarea id="initial_test" name="initial_test" defaultValue={report?.initial_test ?? ""} placeholder="Démarrage, affichage, symptômes constatés à réception…" className="min-h-[72px]" />
      </Field>
      <Field label="Commentaires" htmlFor="comments" className="sm:col-span-2">
        <Textarea id="comments" name="comments" defaultValue={report?.comments ?? ""} className="min-h-[72px]" />
      </Field>
      <div className="sm:col-span-2">
        <Feedback state={state} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" loading={pending}>
          {report ? "Mettre à jour la réception" : "Enregistrer la réception"}
        </Button>
      </div>
    </form>
  );
}

export function DiagnosticForm({ orderId, diagnostic, declaredFault, canStartRepair }: { orderId: string; diagnostic: { declared_fault: string | null; fault_reproduced: boolean | null; findings: string | null; severity: string | null; outcome: string | null; recommended_work: string | null; parts_needed: string | null; internal_notes: string | null; customer_summary: string | null; completed_at: string | null } | null; declaredFault: string; canStartRepair: boolean }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveDiagnosticAction, null);
  useRefresh(state);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="order_id" value={orderId} />
      <Field label="Panne déclarée par le client" htmlFor="declared_fault">
        <Input id="declared_fault" name="declared_fault" defaultValue={diagnostic?.declared_fault ?? declaredFault} />
      </Field>
      <Field label="Panne reproduite ?" htmlFor="fault_reproduced">
        <Select id="fault_reproduced" name="fault_reproduced" defaultValue={diagnostic?.fault_reproduced == null ? "" : diagnostic.fault_reproduced ? "yes" : "no"}>
          <option value="">Non testé</option>
          <option value="yes">Oui</option>
          <option value="no">Non</option>
        </Select>
      </Field>
      <Field label="Constat technique" htmlFor="findings" className="sm:col-span-2">
        <Textarea id="findings" name="findings" defaultValue={diagnostic?.findings ?? ""} />
      </Field>
      <Field label="Gravité" htmlFor="severity">
        <Select id="severity" name="severity" defaultValue={diagnostic?.severity ?? ""}>
          <option value="">—</option>
          <option value="LOW">Faible</option>
          <option value="MEDIUM">Moyenne</option>
          <option value="HIGH">Élevée</option>
          <option value="CRITICAL">Critique</option>
        </Select>
      </Field>
      <Field label="Conclusion" htmlFor="outcome" required>
        <Select id="outcome" name="outcome" defaultValue={diagnostic?.outcome ?? ""}>
          <option value="">—</option>
          {Object.entries(DIAGNOSTIC_OUTCOME_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Travaux recommandés" htmlFor="recommended_work">
        <Textarea id="recommended_work" name="recommended_work" defaultValue={diagnostic?.recommended_work ?? ""} className="min-h-[72px]" />
      </Field>
      <Field label="Pièces nécessaires" htmlFor="parts_needed">
        <Textarea id="parts_needed" name="parts_needed" defaultValue={diagnostic?.parts_needed ?? ""} className="min-h-[72px]" />
      </Field>
      <Field label="Résumé pour le client" htmlFor="customer_summary" className="sm:col-span-2" hint="Envoyé par e-mail à la fin du diagnostic.">
        <Textarea id="customer_summary" name="customer_summary" defaultValue={diagnostic?.customer_summary ?? ""} className="min-h-[72px]" />
      </Field>
      <Field label="Notes internes (jamais visibles par le client)" htmlFor="internal_notes" className="sm:col-span-2">
        <Textarea id="internal_notes" name="internal_notes" defaultValue={diagnostic?.internal_notes ?? ""} className="min-h-[72px]" />
      </Field>
      {canStartRepair ? (
        <label className="flex items-center gap-2 text-sm text-ink-soft sm:col-span-2">
          <Checkbox name="start_repair" defaultChecked /> Si réparable : lancer directement la réparation commandée (sinon, créez un devis complémentaire)
        </label>
      ) : null}
      <div className="sm:col-span-2">
        <Feedback state={state} />
      </div>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button type="submit" name="complete" value="0" variant="outline" loading={pending}>
          Enregistrer le brouillon
        </Button>
        <Button type="submit" name="complete" value="1" loading={pending}>
          {diagnostic?.completed_at ? "Mettre à jour et renotifier" : "Terminer le diagnostic et notifier"}
        </Button>
      </div>
    </form>
  );
}

export function QuoteForm({ orderId, options }: { orderId: string; options: { id: string; name: string; price_cents: number; estimated_cost_cents: number }[] }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createQuoteAction, null);
  useRefresh(state);
  const [rows, setRows] = useState([0]);
  return (
    <form action={action} className="space-y-4" key={state?.ok ? "sent" : "draft"}>
      <input type="hidden" name="order_id" value={orderId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Titre de la proposition" htmlFor="title" required>
          <Input id="title" name="title" required placeholder="Ex : Nettoyage complet" />
        </Field>
        <Field label="Constat (affiché au client)" htmlFor="diagnosis_summary">
          <Input id="diagnosis_summary" name="diagnosis_summary" placeholder="Ex : Accumulation importante de poussière constatée." />
        </Field>
      </div>
      <Field label="Message au client" htmlFor="message" hint="Expliquez simplement ce qui a été constaté et pourquoi vous proposez cette intervention. Joignez des photos (onglet Médias, type Devis).">
        <Textarea id="message" name="message" />
      </Field>
      <div className="space-y-3">
        <p className="text-sm font-medium text-ink">Lignes du devis</p>
        {rows.map((i) => (
          <QuoteRow key={i} index={i} options={options} />
        ))}
        {rows.length < 10 ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setRows((r) => [...r, (r[r.length - 1] ?? 0) + 1])}>
            + Ajouter une ligne
          </Button>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 text-sm text-ink-soft">
        <label className="flex items-center gap-2">
          <Checkbox name="is_required_for_repair" /> Cette intervention est nécessaire pour réaliser la réparation commandée (un refus bloque la réparation)
        </label>
        <label className="flex items-center gap-2">
          <Checkbox name="requires_payment" value="on" defaultChecked /> Paiement en ligne requis avant intervention
        </label>
        <label className="flex items-center gap-2">
          <Checkbox name="send_now" defaultChecked /> Envoyer immédiatement au client
        </label>
      </div>
      <Feedback state={state} />
      <Button type="submit" loading={pending}>
        Créer le devis
      </Button>
    </form>
  );
}

function QuoteRow({ index, options }: { index: number; options: { id: string; name: string; price_cents: number; estimated_cost_cents: number }[] }) {
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [optionId, setOptionId] = useState("");
  return (
    <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_2fr_80px_110px_110px]">
      <Select
        aria-label="Option du catalogue"
        name={`item_option_${index}`}
        value={optionId}
        onChange={(e) => {
          const opt = options.find((o) => o.id === e.target.value);
          setOptionId(e.target.value);
          if (opt) {
            setLabel(opt.name);
            setPrice((opt.price_cents / 100).toFixed(2));
            setCost((opt.estimated_cost_cents / 100).toFixed(2));
          }
        }}
      >
        <option value="">Ligne libre</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} — {formatPrice(o.price_cents)}
          </option>
        ))}
      </Select>
      <Input aria-label="Libellé" name={`item_label_${index}`} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Libellé" />
      <Input aria-label="Quantité" name={`item_quantity_${index}`} type="number" min={1} defaultValue={1} />
      <Input aria-label="Prix TTC" name={`item_price_${index}`} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Prix €" />
      <Input aria-label="Coût estimé" name={`item_cost_${index}`} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Coût €" />
      <Input aria-label="Description" name={`item_description_${index}`} placeholder="Description (facultatif)" className="sm:col-span-5" />
    </div>
  );
}

export function SendQuoteButton({ quoteId, className, label = "Envoyer au client" }: { quoteId: string; className?: string; label?: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(sendQuoteAction, null);
  useRefresh(state);
  return (
    <form action={action} className={className ? `flex flex-col gap-1 ${className.includes("flex-[") ? "" : "inline-flex"}` : "inline-flex flex-col gap-1"} style={className?.includes("flex-[") ? { flex: "1 1 150px" } : undefined}>
      <input type="hidden" name="quote_id" value={quoteId} />
      <Button type="submit" size="sm" variant={className ? "accent" : "primary"} loading={pending} className={className ? "w-full py-[13px]" : undefined}>
        {label}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

export function PartForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addPartAction, null);
  useRefresh(state);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_70px_100px_auto]" key={state?.ok ? "sent" : "draft"}>
      <input type="hidden" name="order_id" value={orderId} />
      <Input name="name" required placeholder="Pièce" aria-label="Pièce" />
      <Input name="reference" placeholder="Référence" aria-label="Référence" />
      <Input name="supplier" placeholder="Fournisseur" aria-label="Fournisseur" />
      <Input name="quantity" type="number" min={1} defaultValue={1} aria-label="Quantité" />
      <Input name="unit_cost" inputMode="decimal" placeholder="Coût €" aria-label="Coût unitaire" />
      <Button type="submit" size="sm" loading={pending} className="h-auto">
        Ajouter
      </Button>
      <div className="sm:col-span-6">
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function WorkLogForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addWorkLogAction, null);
  useRefresh(state);
  return (
    <form action={action} className="space-y-2" key={state?.ok ? "sent" : "draft"}>
      <input type="hidden" name="order_id" value={orderId} />
      <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
        <Input name="description" required placeholder="Intervention réalisée…" aria-label="Description" />
        <Input name="minutes" type="number" min={0} placeholder="Minutes" aria-label="Minutes passées" />
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <Checkbox name="visible" /> Afficher dans l&apos;historique visible par le client
      </label>
      <Feedback state={state} />
      <Button type="submit" size="sm" loading={pending}>
        Enregistrer l&apos;intervention
      </Button>
    </form>
  );
}

export function TestResultsForm({ orderId, testId, results, notes }: { orderId: string; testId: string; results: { id: string; label: string; status: string; comment: string | null }[]; notes: string | null }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveTestResultsAction, null);
  useRefresh(state);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="test_id" value={testId} />
      <ul className="divide-y divide-border rounded-md border border-border">
        {results.map((r) => (
          <li key={r.id} className="grid gap-2 px-3 py-2 sm:grid-cols-[1fr_140px_1fr] sm:items-center">
            <span className="text-sm font-medium text-ink">{r.label}</span>
            <Select name={`result_${r.id}`} defaultValue={r.status} aria-label={`Résultat : ${r.label}`}>
              <option value="PENDING">À tester</option>
              <option value="PASS">OK</option>
              <option value="FAIL">Échec</option>
              <option value="NA">Non applicable</option>
            </Select>
            <Input name={`comment_${r.id}`} defaultValue={r.comment ?? ""} placeholder="Commentaire" aria-label={`Commentaire : ${r.label}`} />
          </li>
        ))}
      </ul>
      <Field label="Notes" htmlFor="test_notes">
        <Textarea id="test_notes" name="notes" defaultValue={notes ?? ""} className="min-h-[64px]" />
      </Field>
      <Feedback state={state} />
      <div className="flex gap-2">
        <Button type="submit" name="complete" value="0" variant="outline" loading={pending}>
          Enregistrer
        </Button>
        <Button type="submit" name="complete" value="1" loading={pending}>
          Valider le contrôle qualité
        </Button>
      </div>
    </form>
  );
}

export function ReturnLabelForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createReturnLabelAction, null);
  useRefresh(state);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="order_id" value={orderId} />
      <div className="grid gap-2 sm:grid-cols-4">
        <Field label="Poids (g)" htmlFor="weight_grams">
          <Input id="weight_grams" name="weight_grams" type="number" min={100} defaultValue={3000} />
        </Field>
        <Field label="L (cm)" htmlFor="length_cm">
          <Input id="length_cm" name="length_cm" type="number" min={1} />
        </Field>
        <Field label="l (cm)" htmlFor="width_cm">
          <Input id="width_cm" name="width_cm" type="number" min={1} />
        </Field>
        <Field label="H (cm)" htmlFor="height_cm">
          <Input id="height_cm" name="height_cm" type="number" min={1} />
        </Field>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Valeur déclarée (€)" htmlFor="declared_value">
          <Input id="declared_value" name="declared_value" inputMode="decimal" />
        </Field>
        <label className="flex items-center gap-2 pb-3 text-sm text-ink-soft">
          <Checkbox name="insured" defaultChecked /> Assurance
        </label>
      </div>
      <Feedback state={state} />
      <Button type="submit" size="sm" loading={pending}>
        Générer l&apos;étiquette de retour
      </Button>
    </form>
  );
}

export function ManualShipmentForm({ orderId, direction }: { orderId: string; direction: "TO_WORKSHOP" | "TO_CUSTOMER" }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(recordShipmentAction, null);
  useRefresh(state);
  return (
    <form action={action} className="space-y-3" key={state?.ok ? "sent" : "draft"}>
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="direction" value={direction} />
      <div className="grid gap-2 sm:grid-cols-2">
        <Input name="carrier_name" required placeholder="Transporteur" aria-label="Transporteur" />
        <Input name="tracking_number" required placeholder="Numéro de suivi" aria-label="Numéro de suivi" className="font-mono" />
        <Input name="tracking_url" type="url" placeholder="URL de suivi (facultatif)" aria-label="URL de suivi" />
        <Input name="cost" inputMode="decimal" placeholder="Coût transport €" aria-label="Coût" />
      </div>
      <Feedback state={state} />
      <Button type="submit" size="sm" variant="outline" loading={pending}>
        Enregistrer l&apos;expédition {direction === "TO_WORKSHOP" ? "aller" : "retour"}
      </Button>
    </form>
  );
}

export function MarkShippedForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(markShippedAction, null);
  useRefresh(state);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="order_id" value={orderId} />
      <Feedback state={state} />
      <Button type="submit" variant="accent" loading={pending}>
        Confirmer l&apos;expédition et notifier le client
      </Button>
    </form>
  );
}

export function RefundForm({ paymentId, maxCents }: { paymentId: string; maxCents: number }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(refundPaymentAction, null);
  useRefresh(state);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="payment_id" value={paymentId} />
      <Field label={`Montant (max ${formatPrice(maxCents)})`} htmlFor={`refund_${paymentId}`}>
        <Input id={`refund_${paymentId}`} name="amount" inputMode="decimal" defaultValue={(maxCents / 100).toFixed(2)} className="w-32" />
      </Field>
      <Field label="Motif" htmlFor={`reason_${paymentId}`}>
        <Input id={`reason_${paymentId}`} name="reason" className="w-56" />
      </Field>
      <Button type="submit" size="sm" variant="danger" loading={pending}>
        Rembourser
      </Button>
      <div className="basis-full">
        <Feedback state={state} />
      </div>
    </form>
  );
}
