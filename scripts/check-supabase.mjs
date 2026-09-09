#!/usr/bin/env node
/**
 * Diagnostic de la configuration Supabase d'un déploiement.
 *
 *   node scripts/check-supabase.mjs                 # variables de l'environnement courant
 *   node scripts/check-supabase.mjs .env.vercel     # variables lues dans un fichier
 *
 * Pour vérifier ce que la production utilise réellement :
 *   vercel env pull .env.vercel --environment=production
 *   node scripts/check-supabase.mjs .env.vercel
 *
 * Aucun secret n'est affiché : seuls la référence du projet et un préfixe le sont.
 */
import { readFileSync } from "node:fs";

const results = [];
const ok = (label, detail = "") => results.push({ level: "ok", label, detail });
const fail = (label, detail, fix) => results.push({ level: "fail", label, detail, fix });
const warn = (label, detail, fix) => results.push({ level: "warn", label, detail, fix });

function loadEnvFile(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

/** Référence du projet contenue dans une clé anon/service au format JWT. */
function projectRefFromKey(key) {
  const parts = key.split(".");
  if (parts.length !== 3) return null; // clés sb_publishable_… / sb_secret_… : pas un JWT
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return { ref: payload.ref ?? null, role: payload.role ?? null, exp: payload.exp ?? null };
  } catch {
    return null;
  }
}

async function request(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    return { status: response.status, text };
  } catch (error) {
    return { status: 0, text: String(error?.cause?.message ?? error.message) };
  } finally {
    clearTimeout(timer);
  }
}

const file = process.argv[2];
const env = { ...process.env, ...(file ? loadEnvFile(file) : {}) };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
const site = env.NEXT_PUBLIC_SITE_URL;

console.log(`Diagnostic Supabase${file ? ` (variables lues dans ${file})` : ""}\n`);

// 1. Présence des variables
if (!url) fail("NEXT_PUBLIC_SUPABASE_URL", "absente", "Ajoutez-la : https://<ref>.supabase.co (Supabase → Settings → API).");
if (!anon) fail("NEXT_PUBLIC_SUPABASE_ANON_KEY", "absente", "Ajoutez la clé « anon / public » (Supabase → Settings → API).");
if (!service) fail("SUPABASE_SERVICE_ROLE_KEY", "absente", "Ajoutez la clé « service_role ». Serveur uniquement, jamais préfixée NEXT_PUBLIC_.");
if (!site) warn("NEXT_PUBLIC_SITE_URL", "absente", "Sans elle les liens d'e-mail et les retours de paiement pointent vers localhost.");

if (url && anon) {
  // 2. Forme de l'URL
  let host = null;
  try {
    const parsed = new URL(url);
    host = parsed.host;
    if (parsed.pathname !== "/") warn("NEXT_PUBLIC_SUPABASE_URL", `contient un chemin (${parsed.pathname})`, "Gardez uniquement l'origine : https://<ref>.supabase.co");
    if (url.endsWith("/")) warn("NEXT_PUBLIC_SUPABASE_URL", "se termine par « / »", "Retirez la barre oblique finale.");
    ok("NEXT_PUBLIC_SUPABASE_URL", host);
  } catch {
    fail("NEXT_PUBLIC_SUPABASE_URL", `« ${url} » n'est pas une URL valide`, "Format attendu : https://<ref>.supabase.co");
  }

  // 3. La clé appartient-elle bien à ce projet ?
  const anonClaims = projectRefFromKey(anon);
  const urlRef = host?.match(/^([a-z0-9]+)\.supabase\.(co|in)$/)?.[1] ?? null;
  if (anonClaims && urlRef) {
    if (anonClaims.ref && anonClaims.ref !== urlRef) {
      fail("NEXT_PUBLIC_SUPABASE_ANON_KEY", `appartient au projet « ${anonClaims.ref} » alors que l'URL vise « ${urlRef} »`, "Recopiez les deux valeurs depuis le MÊME projet Supabase.");
    } else {
      ok("Clé anon et URL", `même projet (${urlRef})`);
    }
    if (anonClaims.role && anonClaims.role !== "anon") {
      fail("NEXT_PUBLIC_SUPABASE_ANON_KEY", `porte le rôle « ${anonClaims.role} »`, "Utilisez la clé « anon / public », pas la clé service_role.");
    }
    if (anonClaims.exp && anonClaims.exp * 1000 < Date.now()) {
      fail("NEXT_PUBLIC_SUPABASE_ANON_KEY", "expirée", "Régénérez les clés dans Supabase → Settings → API.");
    }
  }
  const serviceClaims = service ? projectRefFromKey(service) : null;
  if (serviceClaims?.role && serviceClaims.role !== "service_role") {
    fail("SUPABASE_SERVICE_ROLE_KEY", `porte le rôle « ${serviceClaims.role} »`, "Utilisez la clé « service_role ».");
  }
  if (serviceClaims?.ref && urlRef && serviceClaims.ref !== urlRef) {
    fail("SUPABASE_SERVICE_ROLE_KEY", `appartient au projet « ${serviceClaims.ref} » alors que l'URL vise « ${urlRef} »`, "Recopiez les deux valeurs depuis le même projet.");
  }

  // 4. Le projet répond-il ?
  const health = await request(`${url.replace(/\/$/, "")}/auth/v1/health`);
  if (health.status === 0) {
    fail("Joignabilité du projet", `aucune réponse (${health.text})`, "URL erronée, projet supprimé, ou projet mis en pause : réveillez-le depuis le tableau de bord Supabase.");
  } else if (health.status === 503) {
    fail("Joignabilité du projet", "503 : projet en pause ou indisponible", "Réveillez le projet depuis le tableau de bord Supabase.");
  } else if (health.status === 404) {
    fail("Joignabilité du projet", "404 : cette URL n'expose pas l'API du projet", "Utilisez l'URL « Project URL » de Supabase → Settings → API.");
  } else if (health.status >= 200 && health.status < 400) {
    ok("Joignabilité du projet", `service d'authentification joignable (HTTP ${health.status})`);
  } else {
    warn("Joignabilité du projet", `le projet répond mais renvoie HTTP ${health.status} sur /auth/v1/health`, "Cause précisée par les vérifications de clés ci-dessous.");
  }

  // 5. La clé anon est-elle acceptée ? Dès que l'hôte a répondu quelque chose.
  if (health.status !== 0 && health.status !== 503) {
    const settings = await request(`${url.replace(/\/$/, "")}/auth/v1/settings`, { headers: { apikey: anon, Authorization: `Bearer ${anon}` } });
    if (settings.status === 401) {
      fail("NEXT_PUBLIC_SUPABASE_ANON_KEY", "refusée par le projet (401 Invalid API key)", "Recopiez la clé « anon / public » du projet visé par l'URL.");
    } else if (settings.status >= 200 && settings.status < 300) {
      ok("NEXT_PUBLIC_SUPABASE_ANON_KEY", "acceptée par le projet");
    } else {
      warn("NEXT_PUBLIC_SUPABASE_ANON_KEY", `réponse inattendue (HTTP ${settings.status})`, "Vérifiez l'état du projet dans le tableau de bord Supabase.");
    }

    // 6. Le flux mot de passe fonctionne-t-il de bout en bout ?
    const probe = await request(`${url.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anon, "content-type": "application/json" },
      body: JSON.stringify({ email: `diagnostic-${Date.now()}@example.invalid`, password: "diagnostic-mot-de-passe" }),
    });
    if (probe.status === 400 && probe.text.includes("invalid_credentials")) {
      ok("Connexion par mot de passe", "le service répond normalement (identifiants refusés, comme attendu)");
    } else if (probe.status === 500) {
      fail("Base de données d'authentification", `500 : ${probe.text.slice(0, 120)}`, "Le schéma auth est incomplet : rejouez « supabase db push » sur ce projet.");
    } else if (probe.status === 401) {
      fail("NEXT_PUBLIC_SUPABASE_ANON_KEY", "refusée sur le point d'entrée de connexion", "Recopiez la clé anon du projet visé par l'URL.");
    } else {
      warn("Connexion par mot de passe", `réponse inattendue (HTTP ${probe.status}) : ${probe.text.slice(0, 120)}`, "");
    }
  }

  // 7. Clé service_role
  if (service) {
    const rest = await request(`${url.replace(/\/$/, "")}/rest/v1/profiles?select=id&limit=1`, { headers: { apikey: service, Authorization: `Bearer ${service}` } });
    if (rest.status === 401) fail("SUPABASE_SERVICE_ROLE_KEY", "refusée par le projet (401)", "Recopiez la clé service_role du projet visé par l'URL.");
    else if (rest.status === 404) fail("Schéma applicatif", "la table « profiles » est absente", "Les migrations n'ont pas été appliquées : « supabase db push ».");
    else if (rest.status >= 200 && rest.status < 300) ok("SUPABASE_SERVICE_ROLE_KEY", "acceptée, table « profiles » présente");
    else warn("SUPABASE_SERVICE_ROLE_KEY", `réponse inattendue (HTTP ${rest.status})`, "");
  }
}

// 8. URL publique du site
if (site) {
  try {
    const parsed = new URL(site);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      warn("NEXT_PUBLIC_SITE_URL", "pointe vers localhost", "En production, mettez le domaine public : les liens d'e-mail et les retours de paiement en dépendent.");
    } else if (parsed.protocol !== "https:") {
      warn("NEXT_PUBLIC_SITE_URL", "n'utilise pas https", "Utilisez https en production.");
    } else {
      ok("NEXT_PUBLIC_SITE_URL", parsed.origin);
    }
    if (site.endsWith("/")) warn("NEXT_PUBLIC_SITE_URL", "se termine par « / »", "Retirez la barre oblique finale : les URL construites contiendraient « // ».");
  } catch {
    fail("NEXT_PUBLIC_SITE_URL", `« ${site} » n'est pas une URL valide`, "Format attendu : https://mon-domaine.fr");
  }
}

const ICON = { ok: "✔", warn: "!", fail: "✘" };
for (const r of results) {
  console.log(`${ICON[r.level]} ${r.label}${r.detail ? ` — ${r.detail}` : ""}`);
  if (r.fix) console.log(`    → ${r.fix}`);
}

const failures = results.filter((r) => r.level === "fail");
console.log(`\n${failures.length ? `${failures.length} problème(s) bloquant(s).` : "Configuration Supabase valide."}`);
console.log("Rappel Vercel : une variable ajoutée ou modifiée ne s'applique qu'au prochain déploiement (Redeploy).");
process.exit(failures.length ? 1 : 0);
