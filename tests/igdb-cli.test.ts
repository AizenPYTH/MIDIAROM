import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error — module JavaScript en ligne de commande, sans types.
import { FIELDS, quote, searchBody } from "../scripts/lib/igdb-cli.mjs";

/**
 * La requête IGDB des scripts doit rester celle de l'application.
 *
 * Ce test existe à cause d'une panne réelle : `scripts/demo-games.mjs` portait
 * sa propre copie de la requête et y avait gagné un filtre `& category = 0`.
 * IGDB n'alimente plus ce champ — il a été remplacé par `game_type` —, la
 * requête répondait donc 200 avec une liste vide, et les 28 titres ressortaient
 * « introuvables » sans la moindre erreur HTTP. Un filtre mort ne se voit pas :
 * il faut un test pour le voir.
 */

const CLIENT = readFileSync(path.join(__dirname, "../lib/igdb/client.ts"), "utf8");

/** La liste de champs telle qu'elle est écrite dans un fichier source. */
function fieldsOf(source: string): string[] {
  const block = source.match(/const FIELDS = \[([\s\S]*?)\]\.join\(","\)/);
  if (!block) throw new Error("FIELDS introuvable dans la source");
  return [...block[1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
}

/** La clause `where` de la recherche par nom. */
function whereOf(source: string): string {
  const m = source.match(/search \$\{quote\(term\)\}; fields \$\{FIELDS\}; (where [^;]*);/);
  if (!m) throw new Error("requête de recherche introuvable dans la source");
  return m[1]!;
}

describe("socle IGDB des scripts", () => {
  it("demande exactement les mêmes champs que le client de l'application", () => {
    expect(FIELDS.split(",")).toEqual(fieldsOf(CLIENT));
  });

  it("filtre exactement comme le client de l'application", () => {
    expect(searchBody("elden ring")).toContain(`${whereOf(CLIENT)};`);
  });

  it("ne filtre pas sur `category`, champ qu'IGDB n'alimente plus", () => {
    // Le filtre qui avait vidé les 28 recherches. `game_type` l'a remplacé ;
    // on n'en ajoute aucun des deux, le tri se fait sur les résultats reçus.
    expect(searchBody("elden ring")).not.toMatch(/\bcategory\s*=/);
    expect(whereOf(CLIENT)).not.toMatch(/\bcategory\s*=/);
  });

  it("n'a qu'un seul filtre : les rééditions parasites", () => {
    expect(searchBody("elden ring")).toContain("where version_parent = null;");
  });

  it("échappe les titres comme le client : guillemets et antislashs", () => {
    expect(quote('Marvel\'s "Spider-Man"')).toBe('"Marvel\'s \\"Spider-Man\\""');
    expect(searchBody('Astérix & Obélix: "XXL"')).toContain('search "Astérix & Obélix: \\"XXL\\"";');
  });

  it("borne la recherche et laisse le champ libre à l'appelant", () => {
    expect(searchBody("zelda", { limit: 5, fields: "id,name" })).toBe(
      'search "zelda"; fields id,name; where version_parent = null; limit 5;',
    );
  });
});
