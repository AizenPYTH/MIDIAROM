import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { importExternalProduct } from "@/lib/catalog/import";
import type { ExternalProduct } from "@/lib/catalog/providers/types";

/**
 * L'import crée-t-il vraiment un brouillon, et rien d'autre ?
 *
 * Les tests unitaires couvrent la lecture d'une fiche externe. Celui-ci vérifie
 * ce qu'aucun test en mémoire ne peut prouver : la ligne écrite en base est
 * hors ligne, sans prix ni stock, dans le bon rayon, et ses images restent
 * créditées à leur source au lieu d'atterrir dans les visuels du magasin.
 */
const enabled = process.env.INTEGRATION === "1" && Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const d = enabled ? describe : describe.skip;

const db = () =>
  createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

const REF = `TEST-${Date.now()}`;
const fiche = (over: Partial<ExternalProduct> = {}): ExternalProduct => ({
  ref: REF,
  name: "Test — figurine d'intégration",
  url: "https://example.invalid/p/1",
  manufacturer: "Bandai",
  series: "One Piece",
  category: "Figures",
  availability: "In Stock",
  character: "Luffy",
  ean: null,
  size: "30 cm",
  releaseDate: "2026-03",
  description: "Fiche de test.",
  images: [{ url: "https://example.invalid/a.jpg", source: "HLJ", sourceUrl: "https://example.invalid/p/1" }],
  priceCents: 1280000,
  currency: "JPY",
  ...over,
});

async function cleanup() {
  await db().from("products").delete().eq("source", "TEST-HLJ");
}

d("import d'une figurine", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  it("crée un brouillon hors ligne, sans prix ni stock", async () => {
    const result = await importExternalProduct(fiche(), "TEST-HLJ");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { data } = await db().from("products").select("*").eq("id", result.productId).single();
    expect(data).toBeTruthy();
    // Les trois garanties de l'import.
    expect(data!.is_active).toBe(false);
    expect(data!.price_cents).toBe(0);
    expect(data!.quantity).toBe(0);
    expect(data!.category).toBe("COLLECTIBLE");
  });

  it("garde les visuels du côté de leur source, jamais dans ceux du magasin", async () => {
    const { data } = await db().from("products").select("images, external_images, source, source_ref, source_url").eq("source", "TEST-HLJ").single();
    // `images` est ce que la boutique affiche : il doit rester vide tant que le
    // magasin n'a pas fourni une photo à lui.
    expect(data!.images).toEqual([]);
    expect(data!.external_images).toEqual([
      { url: "https://example.invalid/a.jpg", source: "HLJ", sourceUrl: "https://example.invalid/p/1" },
    ]);
    expect(data!.source).toBe("TEST-HLJ");
    expect(data!.source_ref).toBe(REF);
    expect(data!.source_url).toBe("https://example.invalid/p/1");
  });

  it("range les attributs de la figurine dans les specs affichées", async () => {
    const { data } = await db().from("products").select("specs").eq("source", "TEST-HLJ").single();
    const specs = data!.specs as Record<string, string>;
    expect(specs.Fabricant).toBe("Bandai");
    expect(specs.Licence).toBe("One Piece");
    expect(specs.Personnage).toBe("Luffy");
    expect(specs.Dimensions).toBe("30 cm");
  });

  it("refuse d'importer deux fois la même référence", async () => {
    const second = await importExternalProduct(fiche({ name: "Doublon" }), "TEST-HLJ");
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toMatch(/déjà import/i);
  });

  it("ne reprend jamais le prix de la source", async () => {
    const { data } = await db().from("products").select("price_cents, cost_cents").eq("source", "TEST-HLJ").single();
    expect(data!.price_cents).toBe(0);
    expect(data!.cost_cents).toBe(0);
  });
});
