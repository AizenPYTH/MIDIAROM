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

## Comment la recherche fonctionne

Une requête sur la page de recherche de HobbyLink Japan, à la demande, puis
lecture de ses **données structurées schema.org**
(`<script type="application/ld+json">`). Pas de compte, pas de jeton, pas de
coût, pas de tiers.

Si la page de résultats ne liste que des liens, l'import ouvre les fiches
détaillées — au plus douze, quatre à la fois. Jamais tout le catalogue.

### Pourquoi schema.org et pas les classes CSS

Une première version passait par l'acteur Apify
`jungle_synthesizer/hobbylinkjapan-…-catalog-scraper` en lui envoyant un terme
de recherche. **Cet acteur n'en accepte aucun** : ses entrées sont
`new_releases_weekly`, `preorder_status`, `category_backfill` et `sku_ids`.
C'est un outil de synchronisation de catalogue, pas de recherche. Résultat : un
HTTP 400 au premier essai réel, sur un schéma jamais vérifié.

Lire les classes CSS de la boutique n'aurait pas valu mieux : elles changent
sans préavis et personne ne s'est engagé sur elles. `application/ld+json` est
autre chose — un format public et documenté, que les boutiques publient pour
Google et ont donc intérêt à garder stable. On dépend d'une norme, pas du secret
d'implémentation d'un tiers. C'est aussi ce qui rend la lecture testable hors
ligne, sur des exemples conformes à schema.org.

### Réglages, si le défaut ne convient pas

Deux variables, facultatives, qui évitent de redéployer pour un détail :

```
HLJ_SEARCH_URL=https://www.hlj.com/search/?Word={q}   # {q} = le terme cherché
HLJ_USER_AGENT=MediaromCatalogBot/1.0 (+https://…)    # identification auprès de HLJ
```

### Vérifier

```bash
npm run check:hlj -- "luffy gear 5"
npm run check:hlj -- "luffy gear 5" --raw   # + ce que la page publie vraiment
```

Le script fait **exactement** ce que fait l'écran d'import : même URL, même
lecture. Il ne peut donc pas passer pendant que l'écran échoue — c'est
précisément ce qui s'était produit avec la version Apify.

`--raw` affiche le nombre de blocs JSON-LD, les types rencontrés et le début du
premier bloc. Deux cas si rien ne sort :

1. **l'URL de recherche a changé** → corriger `HLJ_SEARCH_URL` ;
2. **HLJ rend ses résultats dans le navigateur** → aucune lecture de HTML ne
   marchera. Il faudra alors un acteur Apify qui exécute la page, ou une autre
   source. `--raw` permet de trancher entre les deux.

### Ce qu'il faut savoir avant de s'en servir

La recherche interroge un site tiers. Elle est ponctuelle — quelques requêtes
par recherche, déclenchées par un clic —, s'identifie par un User-Agent
explicite, et ne copie rien en masse. Vérifiez tout de même les conditions
d'utilisation de HobbyLink Japan et son `robots.txt` avant un usage régulier :
ce point n'a pas pu être contrôlé depuis l'environnement de développement.

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
