"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, FormSuccess, Input, Select, Textarea } from "@/components/ui/form";
import { saveSettingsAction, setUserRoleAction, updateSavAction, type ActionResult } from "@/app/admin/actions/admin";
import { SAV_STATUS_LABELS } from "@/lib/orders/status";

export interface SettingField {
  name: string;
  label: string;
  type?: "text" | "textarea" | "checkbox" | "cents" | "number" | "email";
  hint?: string;
}

export function SettingsForm({ settingKey, values, fields }: { settingKey: string; values: Record<string, unknown>; fields: SettingField[] }) {
  const bound = saveSettingsAction.bind(null, settingKey);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(bound, null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => {
        const raw = values[f.name];
        const id = `${settingKey}_${f.name}`;
        if (f.type === "checkbox") {
          return (
            <label key={f.name} className="flex items-center gap-2 pt-6 text-sm text-ink">
              <Checkbox name={f.name} defaultChecked={Boolean(raw)} /> {f.label}
            </label>
          );
        }
        const value = raw == null ? "" : f.type === "cents" ? (Number(raw) / 100).toFixed(2) : String(raw);
        return (
          <Field key={f.name} label={f.label} htmlFor={id} hint={f.hint} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
            {f.type === "textarea" ? <Textarea id={id} name={f.name} defaultValue={value} /> : <Input id={id} name={f.name} defaultValue={value} type={f.type === "email" ? "email" : f.type === "number" ? "number" : "text"} inputMode={f.type === "cents" || f.type === "number" ? "decimal" : undefined} />}
          </Field>
        );
      })}
      <div className="sm:col-span-2">
        <FormError message={state && !state.ok ? state.error : null} />
        <FormSuccess message={state?.ok ? (state.message ?? null) : null} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" loading={pending}>Enregistrer</Button>
      </div>
    </form>
  );
}

export function RoleForm({ canManageAdmins }: { canManageAdmins: boolean }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(setUserRoleAction, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <Field label="E-mail du compte" htmlFor="role_email" className="min-w-[260px] flex-1">
        <Input id="role_email" name="email" type="email" required placeholder="technicien@exemple.fr" />
      </Field>
      <Field label="Rôle" htmlFor="role_role">
        <Select id="role_role" name="role" defaultValue="TECHNICIAN">
          <option value="CUSTOMER">Client (retirer l&apos;accès)</option>
          <option value="TECHNICIAN">Technicien</option>
          {canManageAdmins ? <option value="ADMIN">Administrateur</option> : null}
          {canManageAdmins ? <option value="SUPER_ADMIN">Super administrateur</option> : null}
        </Select>
      </Field>
      <Button type="submit" loading={pending}>Appliquer</Button>
      <div className="basis-full">
        <FormError message={state && !state.ok ? state.error : null} />
        <FormSuccess message={state?.ok ? (state.message ?? null) : null} />
      </div>
    </form>
  );
}

export function SavUpdateForm({ savId, status }: { savId: string; status: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(updateSavAction, null);
  return (
    <form action={action} className="space-y-3" key={state?.ok ? "sent" : "draft"}>
      <input type="hidden" name="sav_id" value={savId} />
      <Field label="Statut" htmlFor="sav_status">
        <Select id="sav_status" name="status" defaultValue={status}>
          {Object.entries(SAV_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </Field>
      <Field label="Réponse / note" htmlFor="sav_body">
        <Textarea id="sav_body" name="body" />
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink-soft"><Checkbox name="internal" /> Note interne (non envoyée au client)</label>
      <FormError message={state && !state.ok ? state.error : null} />
      <FormSuccess message={state?.ok ? (state.message ?? null) : null} />
      <Button type="submit" loading={pending}>Mettre à jour</Button>
    </form>
  );
}
