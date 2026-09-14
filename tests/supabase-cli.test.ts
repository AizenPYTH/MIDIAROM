import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error — module JavaScript en ligne de commande, sans types.
import { describeDbError, maskKey, supabaseConfig } from "../scripts/lib/supabase-cli.mjs";

/**
 * Configuration Supabase des scripts.
 *
 * Ce test existe à cause d'une panne réelle : `npm run demo:games` résolvait
 * les 28 jeux puis échouait sur « Invalid path specified in request URL », sans
 * dire quelle URL avait été appelée. Le script passait `process.env` brut à
 * `createClient` et n'affichait que `error.message`.
 */

const AVANT = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
const CLE = "eyJhbGciOi.eyJyb2xlIjo.c2lnbmF0dXJl";

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcd.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = CLE;
});
afterEach(() => {
  if (AVANT.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = AVANT.url;
  if (AVANT.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = AVANT.key;
});

describe("supabaseConfig", () => {
  it("accepte une URL de projet propre", () => {
    const c = supabaseConfig();
    expect(c.url).toBe("https://abcd.supabase.co");
    expect(c.host).toBe("abcd.supabase.co");
    expect(c.avertissements).toEqual([]);
  });

  it("tolère un slash final et les espaces parasites", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "  https://abcd.supabase.co/  ";
    const c = supabaseConfig();
    expect(c.url).toBe("https://abcd.supabase.co");
    expect(c.avertissements).toEqual([]);
  });

  it("retire un chemin collé à l'URL et le signale", () => {
    // Le cas qui produit « Invalid path specified in request URL » :
    // supabase-js ajoute /rest/v1 par-dessus, d'où un chemin doublé.
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcd.supabase.co/rest/v1";
    const c = supabaseConfig();
    expect(c.url).toBe("https://abcd.supabase.co");
    expect(c.avertissements.join(" ")).toContain("/rest/v1");
    expect(c.avertissements.join(" ")).toContain("Invalid path");
  });

  it("retire aussi l'URL du tableau de bord, confusion fréquente", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.com/dashboard/project/abcd";
    expect(supabaseConfig().url).toBe("https://supabase.com");
  });

  it("accepte la pile locale", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    expect(supabaseConfig().url).toBe("http://127.0.0.1:54321");
  });

  it("refuse une URL absente, vide ou illisible", () => {
    for (const valeur of ["", "   ", "abcd.supabase.co", "pas une url"]) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = valeur;
      expect(() => supabaseConfig()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    }
  });

  it("refuse un protocole exotique", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "postgres://abcd.supabase.co";
    expect(() => supabaseConfig()).toThrow(/http/);
  });

  it("refuse une clé service_role absente, en nommant la bonne", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    expect(() => supabaseConfig()).toThrow(/service_role/);
  });

  it("signale une clé qui n'est pas un JWT", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "mon-mot-de-passe-postgres";
    expect(supabaseConfig().avertissements.join(" ")).toContain("JWT");
  });
});

describe("maskKey", () => {
  it("ne laisse jamais filtrer une clé entière", () => {
    const masque = maskKey(CLE);
    expect(masque).not.toContain(CLE);
    expect(masque).toContain("caractères");
    expect(maskKey("")).toBe("ABSENTE");
  });
});

describe("describeDbError", () => {
  const config = { origin: "https://abcd.supabase.co", host: "abcd.supabase.co" };

  it("nomme toujours l'endpoint réellement appelé", () => {
    const t = describeDbError({ message: "boom" }, { config, table: "igdb_games" });
    expect(t).toContain("https://abcd.supabase.co/rest/v1/igdb_games");
  });

  it("explique « Invalid path » par le chemin en trop", () => {
    const t = describeDbError({ message: "Invalid path specified in request URL" }, { config, table: "igdb_games" });
    expect(t).toContain("passerelle Supabase");
    expect(t).toContain("NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co");
  });

  it("explique une table absente par des migrations non appliquées", () => {
    const t = describeDbError({ message: "no table", code: "PGRST205" }, { config, table: "igdb_games" });
    expect(t).toContain("db:push");
  });

  it("explique un refus RLS par une mauvaise clé", () => {
    const t = describeDbError({ message: "denied", code: "42501" }, { config, table: "igdb_games" });
    expect(t).toContain("service_role");
  });

  it("remonte code, détail et piste de PostgREST", () => {
    const t = describeDbError({ message: "m", code: "C1", details: "D1", hint: "H1" }, { config, table: "igdb_games" });
    expect(t).toContain("C1");
    expect(t).toContain("D1");
    expect(t).toContain("H1");
  });

  it("dit quelque chose d'utile même sans message", () => {
    const t = describeDbError({ message: "" }, { config, table: "igdb_games" });
    expect(t).toContain("sans message");
    expect(t).toContain("passerelle Supabase");
  });
});
