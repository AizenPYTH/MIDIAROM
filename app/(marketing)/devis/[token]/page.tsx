import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ROUTES } from "@/config/site";
import { Container } from "@/components/ui/misc";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { MediaGallery } from "@/components/customer/media-gallery";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { signMedia } from "@/lib/media/service";
import { formatDate, formatPrice } from "@/lib/utils/format";
import { DecisionForm } from "@/app/(marketing)/devis/[token]/decision-form";

/**
 * « PlayStation 5 », et non « PlayStation PlayStation 5 ».
 *
 * Les modèles du catalogue portent déjà le nom de la marque ; on ne le préfixe
 * que lorsqu'il manque — une console rétro nommée « Mega Drive », par exemple.
 * Même règle que la fiche de réparation.
 */
function libelleConsole(marque: string, modele: string): string {
  return modele.toLowerCase().startsWith(marque.toLowerCase()) ? modele : `${marque} ${modele}`;
}

/**
 * Le devis, tel que le client le reçoit.
 *
 * Il n'a pas de compte, et n'a pas à en créer un pour répondre : le jeton de
 * l'adresse porte l'autorisation. La page est donc `noindex` **et** jamais
 * mise en cache — elle affiche des données nominatives derrière une URL, ce
 * qui ne se met pas en mémoire partagée.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Votre devis",
  robots: { index: false, follow: false },
};

export default async function QuoteByTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Un jeton court n'a jamais été émis par nous : on s'arrête avant la base.
  if (!token || token.length < 32) notFound();

  const db = createSupabaseAdminClient();
  const { data: quote } = await db
    .from("supplementary_quotes")
    .select("*, items:supplementary_quote_items(*)")
    .eq("decision_token", token)
    .maybeSingle();

  /*
    Le jeton disparaît quand la décision est prise : cette page ne peut donc
    montrer qu'un devis encore en attente. C'est voulu — un lien qui
    continuerait d'afficher un dossier après coup serait un lien qui traîne
    dans une boîte mail pour toujours. Le client garde l'accès complet par son
    espace client et par le suivi.
  */
  if (!quote) {
    return (
      <Container className="max-w-[640px] py-[clamp(40px,5.12vw,64px)]">
        <Alert tone="info" title="Ce lien n'est plus actif">
          Le devis a déjà été traité, ou son lien a expiré. Retrouvez votre dossier depuis le suivi, ou contactez l&apos;atelier — nous vous renverrons un devis à jour.
        </Alert>
        <p className="mt-5 font-mono text-[12px]">
          <Link href={ROUTES.tracking} className="underline hover:text-brand">
            Suivre mon dossier
          </Link>
          {" · "}
          <Link href={ROUTES.contact} className="underline hover:text-brand">
            Contacter l&apos;atelier
          </Link>
        </p>
      </Container>
    );
  }

  const { data: order } = await db
    .from("repair_orders")
    .select("id, order_number, model_name, brand_name, repair_name, customer_first_name, customer_notes, tracking_token, is_quote_request")
    .eq("id", quote.order_id)
    .maybeSingle();
  if (!order) notFound();

  const { data: media } = await db
    .from("order_media")
    .select("*")
    .eq("order_id", order.id)
    .eq("is_visible_to_customer", true)
    .order("created_at", { ascending: false });
  const photos = await signMedia(media ?? []);

  const items = quote.items as { id: string; label: string; description: string | null; quantity: number; unit_price_cents: number; total_cents: number }[];
  const expire = quote.expires_at ? new Date(quote.expires_at) < new Date() : false;

  return (
    <Container className="max-w-[720px] py-[clamp(32px,4.08vw,51px)]">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.19em]" style={{ color: "var(--brand)" }}>
        Devis de réparation
      </span>
      <h1 className="m-0 mt-2.5 text-[clamp(26px,2.56vw,32px)] font-extrabold leading-none tracking-[-0.04em] text-ink">
        Bonjour {order.customer_first_name},
        <br />
        voici votre devis.
      </h1>
      {/* Le montant, dit en toutes lettres avant le détail. Un client qui
          ouvre ce lien cherche un chiffre ; il ne doit pas avoir à parcourir
          un tableau pour le trouver. Le détail reste dessous, pour qui veut
          savoir ce qu'il paie. */}
      <p className="mt-4 text-[18px] leading-[1.5] text-ink">
        Votre réparation est estimée à{" "}
        <strong className="font-extrabold" style={{ color: "var(--brand)" }}>
          {formatPrice(quote.total_cents)}
        </strong>
        .
      </p>
      <p className="mt-2 text-[16px] leading-[1.6] text-ink-soft">
        Pour votre <strong className="text-ink">{libelleConsole(order.brand_name, order.model_name)}</strong>, dossier {order.order_number}. Vous décidez librement : aucune intervention,
        aucun envoi et aucun règlement tant que vous n&apos;avez pas accepté.
      </p>

      {/* Ce que le client nous avait décrit : il doit pouvoir vérifier que le
          devis répond bien à SA panne avant de s'engager. */}
      {order.customer_notes ? (
        <section className="mt-8 border-l-2 bg-surface p-[clamp(14px,1.8vw,20px)]" style={{ borderLeftColor: "var(--brand)" }}>
          <span className="block font-mono text-[9.5px] uppercase tracking-[0.13em] text-ink-faint">Votre description</span>
          <p className="mt-1.5 whitespace-pre-line text-[15px] leading-[1.55] text-ink">{order.customer_notes}</p>
        </section>
      ) : null}

      <section className="mt-2 bg-surface p-[clamp(16px,2vw,24px)]">
        <h2 className="m-0 text-[19px] font-bold tracking-[-0.02em] text-ink">{quote.title}</h2>
        {quote.diagnosis_summary ? <p className="mt-1.5 text-[14.5px] text-ink-soft">Diagnostic : {quote.diagnosis_summary}</p> : null}
        {quote.message ? <p className="mt-3 whitespace-pre-line text-[15px] leading-[1.55] text-ink">{quote.message}</p> : null}

        <ul className="mt-5 divide-y divide-border text-[15px]">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-ink">
                  {item.label}
                  {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                </span>
                {item.description ? <span className="block text-[13px] text-ink-muted">{item.description}</span> : null}
              </span>
              <span className="whitespace-nowrap tabular-nums text-ink">{formatPrice(item.total_cents)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-baseline justify-between border-t-2 border-ink pt-3">
          <span className="text-[17px] font-bold text-ink">Total</span>
          <span className="text-[28px] font-extrabold tracking-[-0.03em]" style={{ color: "var(--brand)" }}>
            {formatPrice(quote.total_cents)}
          </span>
        </div>
        <p className="mt-2 font-mono text-[11.5px] text-ink-muted">
          {quote.expires_at ? <>Valable jusqu&apos;au {formatDate(quote.expires_at)}. </> : null}
          {quote.requires_payment && quote.total_cents > 0 ? "Règlement en ligne après acceptation." : "Règlement à la fin de l'intervention."}
        </p>
      </section>

      {photos.length ? (
        <section className="mt-2 bg-surface p-[clamp(16px,2vw,24px)]">
          <span className="block font-mono text-[9.5px] uppercase tracking-[0.13em] text-ink-faint">Photos du dossier</span>
          <div className="mt-3">
            <MediaGallery media={photos} />
          </div>
        </section>
      ) : null}

      <section className="mt-6">
        {expire ? (
          <Alert tone="warning" title="Devis expiré">
            La durée de validité de ce devis est dépassée. Contactez l&apos;atelier : nous vous en renverrons un à jour, toujours gratuitement.
          </Alert>
        ) : (
          <>
            <h2 className="m-0 mb-4 text-[19px] font-bold tracking-[-0.02em] text-ink">Votre décision</h2>
            <DecisionForm token={token} amountCents={quote.total_cents} />
          </>
        )}
      </section>

      <p className="mt-8 font-mono text-[11.5px] text-ink-muted">
        <Badge tone="neutral">{order.order_number}</Badge>{" "}
        <Link href={`${ROUTES.tracking}/${order.tracking_token}`} className="underline hover:text-brand">
          Suivre mon dossier
        </Link>
        {" · "}
        <Link href={ROUTES.contact} className="underline hover:text-brand">
          Une question ? Contactez l&apos;atelier
        </Link>
      </p>
    </Container>
  );
}
