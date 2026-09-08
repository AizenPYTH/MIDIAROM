import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddressForm } from "@/components/customer/forms";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUserOrRedirect } from "@/lib/security/auth";
import { deleteAddressAction } from "@/app/(account)/compte/actions";

export const metadata: Metadata = { title: "Mes adresses", robots: { index: false } };

export default async function AddressesPage() {
  const user = await requireUserOrRedirect();
  const supabase = await createSupabaseServerClient();
  const { data: addresses } = await supabase.from("addresses").select("*").eq("profile_id", user.id).order("is_default", { ascending: false }).order("created_at");
  return (
    <div className="space-y-6">
      <PageHeader title="Mes adresses" description="Adresse de retour proposée lors de vos prochaines commandes." />
      {addresses?.length ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="rounded-lg border border-border bg-surface p-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-ink">{a.label ?? "Adresse"}</p>
                {a.is_default ? <Badge tone="primary">Par défaut</Badge> : null}
              </div>
              <p className="mt-1 text-ink">
                {a.first_name} {a.last_name}
              </p>
              <p className="text-ink-soft">{a.line1}</p>
              {a.line2 ? <p className="text-ink-soft">{a.line2}</p> : null}
              <p className="text-ink-soft">
                {a.postal_code} {a.city}
              </p>
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-medium text-accent">Modifier</summary>
                <div className="mt-3">
                  <AddressForm address={a} />
                </div>
              </details>
              <form action={deleteAddressAction} className="mt-2">
                <input type="hidden" name="id" value={a.id} />
                <Button type="submit" variant="ghost" size="sm" className="text-danger">
                  Supprimer
                </Button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Ajouter une adresse</CardTitle>
        </CardHeader>
        <CardContent>
          <AddressForm />
        </CardContent>
      </Card>
    </div>
  );
}
