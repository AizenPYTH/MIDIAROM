/**
 * Configuration Supabase des scripts en ligne de commande.
 *
 * **Pourquoi ce fichier existe.** `demo-games.mjs` passait `process.env`
 * directement à `createClient`, sans rien vérifier, et n'affichait que
 * `error.message` en cas d'échec. Quand Supabase a répondu « Invalid path
 * specified in request URL », il n'y avait donc aucun moyen de savoir quelle
 * URL avait été appelée ni pourquoi elle était invalide. Les erreurs
 * PostgREST portent un `code`, un `details` et un `hint` : on les perdait tous.
 *
 * Ce module valide la configuration avant d'écrire quoi que ce soit, répare le
 * cas le plus courant (une URL de projet à laquelle on a collé un chemin), et
 * rend les échecs lisibles.
 */
import { createClient } from "@supabase/supabase-js";

/** Masque une clé pour l'affichage : jamais de secret en clair dans un log. */
export function maskKey(value) {
  if (!value) return "ABSENTE";
  return `${value.slice(0, 6)}…${value.slice(-4)} (${value.length} caractères)`;
}

/**
 * Lit et valide la configuration Supabase.
 *
 * Renvoie `{ url, key, origin, host, avertissements }`, ou jette une erreur
 * dont le message explique quoi corriger.
 *
 * `supabase-js` tolère un slash final et les espaces parasites — vérifié — mais
 * **pas** un chemin : avec `https://<ref>.supabase.co/rest/v1`, il construit
 * `https://<ref>.supabase.co/rest/v1/rest/v1/<table>`, que la passerelle
 * Supabase rejette avec « Invalid path specified in request URL ». On ne garde
 * donc que l'origine, en le disant.
 */
export function supabaseConfig() {
  const raw = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const avertissements = [];

  if (!raw) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL est absente.\n" +
        "  Posez-la dans .env.local : l'URL du projet Supabase, rien de plus\n" +
        "  (Dashboard → Project Settings → Data API → Project URL).",
    );
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL n'est pas une URL valide : ${JSON.stringify(raw)}.\n` +
        "  Attendu : https://<ref>.supabase.co (ou http://127.0.0.1:54321 en local).",
    );
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error(`NEXT_PUBLIC_SUPABASE_URL doit être en http(s), pas « ${parsed.protocol} ».`);
  }

  // Le piège : un chemin collé à l'URL du projet. supabase-js ajoute le sien
  // par-dessus, et la passerelle refuse le chemin doublé.
  const chemin = parsed.pathname.replace(/\/+$/, "");
  if (chemin) {
    avertissements.push(
      `NEXT_PUBLIC_SUPABASE_URL contient un chemin (« ${chemin} ») : il est ignoré.\n` +
        "    supabase-js ajoute /rest/v1 lui-même ; laisser le chemin donne une URL\n" +
        "    doublée, refusée avec « Invalid path specified in request URL ».\n" +
        `    Corrigez .env.local : NEXT_PUBLIC_SUPABASE_URL=${parsed.origin}`,
    );
  }
  if (parsed.search || parsed.hash) {
    avertissements.push("NEXT_PUBLIC_SUPABASE_URL contient une requête ou une ancre : elles sont ignorées.");
  }

  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY est absente.\n" +
        "  C'est la clé `service_role` (Dashboard → Project Settings → API keys),\n" +
        "  pas la clé `anon`. Elle ne doit jamais être préfixée NEXT_PUBLIC_.",
    );
  }
  // Une clé Supabase est un JWT : trois segments séparés par des points. Une
  // clé `anon` collée par erreur passerait ce test, mais pas une URL ni un mot
  // de passe de base de données — les deux confusions les plus fréquentes.
  if (key.split(".").length !== 3) {
    avertissements.push(
      "SUPABASE_SERVICE_ROLE_KEY ne ressemble pas à un JWT (trois segments séparés par des points).\n" +
        "    Vérifiez que ce n'est pas le mot de passe de la base ni une URL.",
    );
  }

  return { url: parsed.origin, key, origin: parsed.origin, host: parsed.host, avertissements };
}

/** Client service-role. Contourne RLS : réservé aux scripts d'atelier. */
export function adminClient(config) {
  return createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Met un échec PostgREST en français lisible.
 *
 * `error.message` seul ne suffit pas : c'est `code`, `details` et `hint` qui
 * distinguent une table absente d'un refus RLS ou d'une URL malformée.
 */
export function describeDbError(error, { config, table }) {
  // Une requête sans corps (HEAD, ou passerelle qui coupe) donne un message
  // vide : mieux vaut nommer le symptôme que d'afficher une ligne nue.
  const message = error.message?.trim() || "Supabase a refusé la requête sans message.";
  const lignes = [`✗ ${message}`];
  const endpoint = `${config.origin}/rest/v1/${table}`;
  lignes.push(`  Endpoint appelé : ${endpoint}`);
  if (error.code) lignes.push(`  Code PostgREST  : ${error.code}`);
  if (error.details) lignes.push(`  Détail          : ${error.details}`);
  if (error.hint) lignes.push(`  Piste           : ${error.hint}`);

  if (/invalid path/i.test(message) || !error.message?.trim()) {
    lignes.push("");
    lignes.push("  Ce message vient de la passerelle Supabase, pas de la base : le chemin");
    lignes.push("  de l'URL ne correspond à aucun de ses services. Presque toujours parce");
    lignes.push("  que NEXT_PUBLIC_SUPABASE_URL porte déjà un chemin (/rest/v1, ou l'URL du");
    lignes.push("  tableau de bord au lieu de celle du projet). Attendu :");
    lignes.push("    NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co");
  }
  if (error.code === "PGRST205" || /schema cache/i.test(message)) {
    lignes.push("");
    lignes.push(`  La table « ${table} » est introuvable sur ce projet : les migrations`);
    lignes.push("  n'y ont pas été appliquées. Lancez `npm run db:push` sur la bonne base.");
  }
  if (error.code === "42501" || /row-level security/i.test(message)) {
    lignes.push("");
    lignes.push("  Écriture refusée par RLS : la clé utilisée n'est pas la clé service_role.");
  }
  return lignes.join("\n");
}
