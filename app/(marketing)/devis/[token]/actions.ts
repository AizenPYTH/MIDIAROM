"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { afterQuoteDecision } from "@/lib/quotes/decision";
import { requestMeta } from "@/lib/security/audit";
import { rateLimit } from "@/lib/security/rate-limit";

export type DecisionState = { ok: true; accepted: boolean } | { ok: false; error: string };

/**
 * Accepter ou refuser un devis depuis le lien reçu par e-mail.
 *
 * Tout ce qui compte se passe dans la base. Le jeton n'est pas vérifié ici : il
 * est passé tel quel à `decide_quote_by_token`, qui le cherche **et** applique
 * la décision dans la même transaction, sous verrou. Vérifier d'abord puis
 * décider ensuite, depuis deux requêtes, laisserait une fenêtre entre les
 * deux ; ici il n'y en a pas.
 *
 * Aucun montant ne transite par cette action. Le navigateur envoie un jeton,
 * une décision et éventuellement un commentaire — jamais un prix. Le montant
 * archivé est celui que la base relit sur le devis.
 */
export async function decideByTokenAction(_prev: DecisionState | null, formData: FormData): Promise<DecisionState> {
  const meta = await requestMeta();
  // Un jeton de 256 bits ne se devine pas, mais rien n'empêche d'essayer :
  // on plafonne les tentatives par adresse.
  const limit = rateLimit(`devis-decision:${meta.ip ?? "unknown"}`, 20, 10 * 60_000);
  if (!limit.allowed) return { ok: false, error: "Trop de tentatives. Merci de patienter quelques minutes." };

  const token = String(formData.get("token") ?? "");
  const decision = formData.get("decision") === "ACCEPTED" ? "ACCEPTED" : formData.get("decision") === "REFUSED" ? "REFUSED" : null;
  if (!decision || !token) return { ok: false, error: "Décision invalide." };
  if (formData.get("confirm") !== "on") return { ok: false, error: "Merci de cocher la case de confirmation." };
  const commentaire = String(formData.get("comment") ?? "").trim().slice(0, 1000) || null;

  const db = createSupabaseAdminClient();
  const { data: quote, error } = await db.rpc("decide_quote_by_token", {
    p_token: token,
    p_decision: decision,
    p_comment: commentaire ?? undefined,
    p_user_agent: meta.userAgent ?? undefined,
    p_ip_address: meta.ip ?? undefined,
  });
  if (error || !quote) {
    // Un jeton faux, périmé ou déjà consommé donnent volontairement la même
    // réponse : rien dans le message ne dit à un curieux s'il a trouvé un
    // devis ou pas.
    const expire = error?.message?.includes("expired");
    return { ok: false, error: expire ? "Ce devis a expiré. Contactez l'atelier pour le renouveler." : "Ce lien n'est plus valide. Le devis a peut-être déjà été traité." };
  }

  await afterQuoteDecision(quote, decision === "ACCEPTED", null);
  /*
    Pas de `revalidatePath` sur cette adresse.

    La décision efface le jeton : re-rendre la page reviendrait à afficher
    « ce lien n'est plus actif » à l'instant précis où le client vient
    d'accepter — le pire moment pour lui laisser croire que son clic a échoué.
    La confirmation est rendue par le composant, à partir de ce retour.
  */
  return { ok: true, accepted: decision === "ACCEPTED" };
}
