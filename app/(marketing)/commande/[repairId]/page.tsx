import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ROUTES } from "@/config/site";
import { Eyebrow } from "@/components/ui/misc";
import { RepairForm } from "@/components/repair/repair-form";
import { IncludedList, PriceTag, RepairFacts } from "@/components/repair/repair-summary";
import { getRepairById, getRepairOffer, getRepairsForModel } from "@/lib/repair/catalog";
import { getRepairFormBase, toFormOffer, toFormRepair } from "@/lib/repair/form-data";
import { getCurrentUser } from "@/lib/security/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Votre demande de réparation", robots: { index: false, follow: false } };

/**
 * Commande d'une prestation : la fiche de réparation s'ouvre à l'étape 2 avec
 * le modèle et la prestation présélectionnés (options, description, coordonnées, paiement).
 */
export default async function CheckoutPage({ params, searchParams }: { params: Promise<{ repairId: string }>; searchParams: Promise<{ cancelled?: string }> }) {
  const [{ repairId }, { cancelled }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(repairId)) notFound();
  const repair = await getRepairById(repairId);
  if (!repair || !repair.is_active) notFound();

  const [offer, repairs, user, base, warranty] = await Promise.all([getRepairOffer(repair), getRepairsForModel(repair.model_id), getCurrentUser(), getRepairFormBase(repair.is_diagnostic_only), getSetting("warranty")]);

  let defaultAddress = null;
  if (user) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from("addresses").select("*").eq("profile_id", user.id).order("is_default", { ascending: false }).limit(1).maybeSingle();
    defaultAddress = data;
  }

  return (
    <section className="bg-ink-900 px-6 py-[56px] text-paper">
      <div className="mx-auto grid max-w-[1280px] items-start gap-12 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
        <div className="flex flex-col gap-[22px]">
          <Eyebrow tone="repair">
            {repair.model.brand.name} · {repair.model.name}
          </Eyebrow>
          <h1 className="text-[clamp(28px,3.4vw,42px)] font-extrabold leading-[1.02] tracking-[-0.02em]">{repair.name}</h1>
          {repair.summary ? <p className="max-w-[42ch] text-[16.5px] leading-[1.55] text-[#c4bdae]">{repair.summary}</p> : null}
          <div className="border border-ink-650 p-[18px]">
            <PriceTag cents={repair.price_cents} compareAt={repair.compare_at_price_cents} />
            <div className="mt-4 [&_dd]:text-paper [&_div]:bg-ink-800 [&_dl]:border-ink-700 [&_dl]:bg-ink-700">
              <RepairFacts repair={repair} />
            </div>
            {repair.included_items.length ? (
              <div className="mt-4 [&_li]:text-[#c4bdae]">
                <IncludedList items={repair.included_items} />
              </div>
            ) : null}
            {repair.warranty_months > 0 ? <p className="mt-4 text-[13px] text-[#a39c8c]">{repair.warranty_scope ?? warranty.scope}</p> : null}
            {repair.important_notes ? <p className="mt-2 text-[13px] text-[#a39c8c]">{repair.important_notes}</p> : null}
          </div>
          <p className="font-mono text-[11.5px] text-ink-muted">
            <Link href={`${ROUTES.repair}/${repair.model.slug}/${repair.fault.slug}`} className="hover:text-paper">
              ← Fiche détaillée
            </Link>
            {" · "}
            <Link href={`${ROUTES.repair}/${repair.model.slug}`} className="hover:text-paper">
              Changer de panne
            </Link>
          </p>
        </div>
        <RepairForm
          models={base.models}
          conditions={base.conditions}
          initialModelId={repair.model_id}
          initialRepairs={repairs.map(toFormRepair)}
          initialRepairId={repair.id}
          initialOffer={toFormOffer(offer)}
          initialStep={2}
          initialCustomer={user ? { first_name: user.profile.first_name ?? "", last_name: user.profile.last_name ?? "", email: user.email, phone: user.profile.phone ?? "" } : null}
          initialAddress={defaultAddress ? { line1: defaultAddress.line1, line2: defaultAddress.line2 ?? "", postal_code: defaultAddress.postal_code, city: defaultAddress.city } : null}
          isLoggedIn={Boolean(user)}
          cancelled={cancelled === "1"}
        />
      </div>
    </section>
  );
}
