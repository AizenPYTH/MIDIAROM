import "server-only";
import { getServerEnv, isProduction } from "@/lib/env";

/**
 * Le bandeau du mode démonstration.
 *
 * `DEMO_MODE=1` autorise, sur une construction de production, le paiement
 * simulé et l'envoi d'e-mails en console. C'est indispensable pour dérouler le
 * tunnel devant un client, et dangereux si personne ne le sait : un visiteur
 * pourrait croire avoir payé. Le bandeau rend l'état visible en permanence, en
 * haut de chaque page, et disparaît de lui-même dès que les vraies
 * intégrations sont configurées.
 *
 * Il ne s'affiche qu'en production : en développement, le simulateur est la
 * norme et le dire à chaque page serait du bruit.
 */
export function DemoBanner() {
  if (!isProduction() || !getServerEnv().DEMO_MODE) return null;
  return (
    <div role="status" className="border-b border-ink px-4 py-2 text-center font-mono text-[10.5px] uppercase tracking-[0.08em]" style={{ background: "var(--brand-gradient)", color: "#fff" }}>
      Mode démonstration — aucun paiement n&apos;est encaissé, aucun e-mail n&apos;est envoyé
    </div>
  );
}
