import type { AuthError } from "@supabase/supabase-js";

/**
 * Traduit un échec de connexion Supabase Auth sans révéler l'existence d'un compte.
 *
 * Seuls les cas que la personne peut corriger sont distingués. Les erreurs de
 * configuration ou de disponibilité (clé API invalide, service injoignable, schéma
 * cassé) ne doivent pas s'afficher comme « mot de passe incorrect » : elles envoient
 * l'utilisateur chercher un mot de passe qui, lui, est bon.
 *
 * `onServerFault` reçoit les erreurs à journaliser côté serveur.
 */
export function loginErrorMessage(error: Pick<AuthError, "code" | "status" | "message">, onServerFault?: (error: Pick<AuthError, "code" | "status" | "message">) => void): string {
  // Supabase ne renvoie « email_not_confirmed » que lorsque le mot de passe est
  // correct : un mot de passe erroné donne « invalid_credentials » dans tous les cas.
  if (error.code === "email_not_confirmed") return "Votre adresse n'est pas encore confirmée. Ouvrez le lien reçu par e-mail, puis reconnectez-vous.";
  if (error.code === "user_banned") return "Ce compte est temporairement suspendu. Contactez-nous.";
  if (error.code === "over_request_rate_limit" || error.status === 429) return "Trop de tentatives. Réessayez dans quelques minutes.";
  if (error.code === "invalid_credentials") return "E-mail ou mot de passe incorrect.";
  onServerFault?.(error);
  return "Connexion impossible : le service d'authentification n'a pas répondu correctement. Réessayez dans un instant.";
}
