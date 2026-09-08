import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/misc";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";
import { getRepairById, getRepairOffer } from "@/lib/repair/catalog";
import { getCurrentUser } from "@/lib/security/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSetting } from "@/lib/settings";
import { getContentBlock, getLegalDocument } from "@/lib/content";
import { consequenceForOutcome } from "@/lib/quotes/rules";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Votre commande", robots: { index: false, follow: false } };

export default async function CheckoutPage({ params, searchParams }: { params: Promise<{ repairId: string }>; searchParams: Promise<{ cancelled?: string }> }) {
  const [{ repairId }, { cancelled }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(repairId)) notFound();
  const repair = await getRepairById(repairId);
  if (!repair || !repair.is_active) notFound();

  const [offer, user, rules, warranty, upsell, cgv] = await Promise.all([
    getRepairOffer(repair),
    getCurrentUser(),
    getSetting("business_rules"),
    getSetting("warranty"),
    getContentBlock("upsell.title"),
    getLegalDocument("cgv"),
  ]);

  let defaultAddress = null;
  if (user) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from("addresses").select("*").eq("profile_id", user.id).order("is_default", { ascending: false }).limit(1).maybeSingle();
    defaultAddress = data;
  }

  const refusal = consequenceForOutcome("QUOTE_REFUSED", rules, repair.is_diagnostic_only);
  const unrepairable = consequenceForOutcome("UNREPAIRABLE", rules, repair.is_diagnostic_only);

  return (
    <Container className="py-8 pb-32 sm:py-12 lg:pb-12">
      <CheckoutFlow
        repair={{
          id: repair.id,
          name: repair.name,
          modelName: repair.model.name,
          modelSlug: repair.model.slug,
          faultName: repair.fault.name,
          priceCents: repair.price_cents,
          includedItems: repair.included_items,
          warrantyMonths: repair.warranty_months,
          warrantyScope: repair.warranty_scope ?? warranty.scope,
          importantNotes: repair.important_notes,
          isDiagnosticOnly: repair.is_diagnostic_only,
          leadTimeMin: repair.lead_time_days_min,
          leadTimeMax: repair.lead_time_days_max,
        }}
        options={offer.options.map((o) => ({ id: o.id, name: o.name, shortDescription: o.short_description, description: o.description, priceCents: o.price_cents, isRecommended: o.is_recommended, categoryId: o.category_id }))}
        packs={offer.packs.map((p) => ({ id: p.id, name: p.name, shortDescription: p.short_description, description: p.description, priceCents: p.price_cents, isRecommended: p.is_recommended, optionIds: p.optionIds, optionNames: p.options.map((o) => o.name) }))}
        shippingMethods={offer.shippingMethods.map((m) => ({ id: m.id, name: m.name, description: m.description, priceCents: m.price_cents, includesOutbound: m.includes_outbound, includesReturn: m.includes_return, insuranceCents: m.insurance_cents }))}
        upsellTitle={upsell?.title ?? "Profitez de l'intervention pour entretenir votre console"}
        upsellText={upsell?.body ?? null}
        conditions={{
          refusalExplanation: refusal.explanation,
          refusalFeeCents: refusal.diagnosticFeeCents + refusal.returnFeeCents,
          unrepairableFeeCents: unrepairable.diagnosticFeeCents + unrepairable.returnFeeCents,
          quoteValidityDays: rules.quote_validity_days,
          cgvVersion: cgv?.version ?? null,
        }}
        initialCustomer={
          user
            ? { first_name: user.profile.first_name ?? "", last_name: user.profile.last_name ?? "", email: user.email, phone: user.profile.phone ?? "" }
            : null
        }
        initialAddress={
          defaultAddress ? { line1: defaultAddress.line1, line2: defaultAddress.line2 ?? "", postal_code: defaultAddress.postal_code, city: defaultAddress.city } : null
        }
        isLoggedIn={Boolean(user)}
        cancelled={cancelled === "1"}
      />
    </Container>
  );
}
