# Import de figurines

## Ce que ça fait

**Admin → Catalogue → Importer une figurine.** On cherche un nom, on regarde
les résultats, on clique sur « Importer ». Un **brouillon** de produit est créé
dans le rayon *Figurines Manga / Anime*. C'est tout.

La recherche est **à la demande** : rien n'est aspiré en masse, rien n'est
stocké tant qu'on n'a pas importé. Une recherche interroge la source, affiche
douze résultats au plus, et s'arrête là.

## Les trois garanties de l'import

Elles ne se négocient pas, et `tests/integration/catalog-import.test.ts` les
vérifie sur une vraie base :

1. **Brouillon.** `is_active = false`, `price_cents = 0`, `quantity = 0`. Un
   produit importé n'est pas un produit en vente : il lui manque le prix, l'état
   et une photo. L'atelier complète dans le stock, puis publie.
2. **Rayon fixe.** `COLLECTIBLE`. Cet import ne sert qu'aux figurines ; il ne
   peut pas créer une console, un composant ou un accessoire informatique.
3. **Images créditées.** Les visuels de la source vont dans `external_images`
   avec leur origine, **jamais** dans `images`. C'est `images` que la boutique
   affiche : elle ne montrera donc que ce dont MÉDI@ROM détient les droits.

### Les images, précisément

| Colonne | Contenu | Affiché en boutique |
| --- | --- | --- |
| `images` | Les photos du magasin | **Oui** |
| `external_images` | `[{url, source, sourceUrl}]` de la source | Non |

Un produit importé arrive donc sans visuel côté boutique. C'est voulu : il faut
photographier la figurine, ou obtenir l'autorisation, avant de la mettre en
ligne. Les visuels de la source restent visibles au back-office pour aider à la
saisie, et gardent l'adresse de leur page d'origine.

## Où vont les informations

| Donnée | Destination |
| --- | --- |
| Nom | `name` |
| JAN / EAN | `ean` |
| Description | `description` |
| Fabricant, licence, personnage, dimensions, date de sortie, référence | `specs` (jsonb, déjà affiché sur la fiche) |
| Référence et page d'origine | `source`, `source_ref`, `source_url` |

Pas une colonne par attribut : `specs` existait, il est affiché, il suffit.
L'index unique `(source, source_ref)` empêche d'importer deux fois la même
référence.

## Configuration

HobbyLink Japan n'expose pas d'API publique. Plutôt qu'un analyseur HTML maison
— à réparer chaque fois que la boutique change une classe CSS, pour quelques
recherches par semaine — l'import passe par un acteur Apify.

```
APIFY_TOKEN=apify_api_...        # Apify → Settings → Integrations
HLJ_APIFY_ACTOR=utilisateur~nom-acteur
```

Jamais `NEXT_PUBLIC_*` : ce jeton ne doit pas atteindre le navigateur. Sans
configuration, l'écran d'import affiche ce qui manque et le reste du site
fonctionne normalement.

```bash
npm run check:hlj                    # la configuration est-elle lue ?
npm run check:hlj -- "luffy gear 5"  # + une vraie recherche
npm run check:hlj -- "luffy" --raw   # + l'objet brut du premier résultat
```

### Pourquoi `--raw` existe

**Un acteur Apify n'est pas un contrat d'API.** Les noms de champs varient d'un
acteur à l'autre et peuvent changer sans préavis. `lib/catalog/providers/hlj.ts`
lit donc plusieurs noms possibles par information (`manufacturer`, `maker`,
`brand`, `company`…), et `toExternalProduct` n'invente rien : une information
absente reste `null`.

Si une colonne ressort vide au premier essai réel, `--raw` montre comment
l'acteur la nomme et la correspondance s'ajuste en une fois, dans ce seul
fichier. C'est la leçon de l'intégration IGDB : un champ mal deviné ne se voit
pas, il vide simplement le résultat.

## Ajouter une autre source

`lib/catalog/providers/types.ts` définit le contrat. Un second fournisseur —
Rakuten, ou autre — est un fichier de plus qui rend le même `ExternalProduct` ;
`lib/catalog/import.ts` et l'écran d'admin n'ont pas à changer.

## Ce que cet import ne fait pas

- Il ne publie rien.
- Il ne fixe aucun prix : le prix de la source est lu mais **jamais repris**
  dans le produit.
- Il ne crée que des figurines. Pas de PC, pas de composants, pas de pièces
  détachées, pas de smartphones — ce ne sont pas des rayons de MÉDI@ROM.
