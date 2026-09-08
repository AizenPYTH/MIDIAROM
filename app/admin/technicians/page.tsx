import { PageHeader } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/form";
import { Section, Table, Td, Th } from "@/components/admin/ui";
import { RoleForm } from "@/components/admin/settings-forms";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrRedirect } from "@/lib/security/auth";
import { ROLE_LABELS } from "@/lib/orders/status";
import { updateTechnicianAction } from "@/app/admin/actions/admin";

export default async function TechniciansPage() {
  const user = await requireAdminOrRedirect();
  const db = createSupabaseAdminClient();
  const [{ data: staff }, { data: technicians }] = await Promise.all([
    db.from("profiles").select("id, email, first_name, last_name, role").in("role", ["TECHNICIAN", "ADMIN", "SUPER_ADMIN"]).order("role"),
    db.from("technicians").select("*").order("display_name"),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Techniciens et accès" description="Un technicien accède à l'atelier (réception, diagnostic, devis, tests, expédition) mais pas au catalogue, aux prix ni aux réglages." />
      <Section title="Donner ou retirer un accès" description="La personne doit d'abord créer un compte sur le site.">
        <RoleForm canManageAdmins={user.profile.role === "SUPER_ADMIN"} />
      </Section>
      <Section title="Équipe">
        <Table>
          <thead><tr><Th>Nom</Th><Th>E-mail</Th><Th>Rôle</Th><Th>Fiche technicien</Th></tr></thead>
          <tbody>
            {(staff ?? []).map((p) => {
              const tech = (technicians ?? []).find((t) => t.profile_id === p.id);
              return (
                <tr key={p.id}>
                  <Td>{p.first_name} {p.last_name}</Td>
                  <Td>{p.email}</Td>
                  <Td><Badge tone={p.role === "TECHNICIAN" ? "info" : "primary"}>{ROLE_LABELS[p.role]}</Badge></Td>
                  <Td>
                    {tech ? (
                      <form action={updateTechnicianAction} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="technician_id" value={tech.id} />
                        <Input name="display_name" defaultValue={tech.display_name} className="h-8 w-36 py-1 text-xs" aria-label="Nom affiché" />
                        <Input name="specialties" defaultValue={tech.specialties.join(", ")} placeholder="Spécialités" className="h-8 w-44 py-1 text-xs" aria-label="Spécialités" />
                        <label className="flex items-center gap-1 text-xs"><Checkbox name="is_active" defaultChecked={tech.is_active} /> actif</label>
                        <Button type="submit" size="sm" variant="outline" className="h-8">OK</Button>
                      </form>
                    ) : <span className="text-xs text-ink-muted">—</span>}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Section>
    </div>
  );
}
