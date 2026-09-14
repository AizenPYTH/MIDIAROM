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

Un appel à **`lulzasaur/hlj-scraper`**, un acteur Apify dédié à la recherche
HobbyLink Japan. On lui envoie les mots-clés (`searchQueries`), il exécute la
page dans un navigateur et rend nom, prix (JPY et USD), fabricant, catégorie,
disponibilité, date de sortie, GTIN, image et URL.

Une seule variable est nécessaire :

```
APIFY_TOKEN=apify_api_…    # apify.com → Settings → API & Integrations
```

À poser dans `.env.local` **et** dans les variables d'environnement Vercel.
Sans elle, l'écran d'import affiche quoi faire au lieu d'échouer.

### Pourquoi un acteur, et pas nous-mêmes

Trois constats, dans l'ordre où ils sont tombés.

1. **L'acteur `jungle_synthesizer/hobbylinkjapan-…-catalog-scraper` n'accepte
   aucun terme de recherche.** Ses entrées sont `new_releases_weekly`,
   `preorder_status`, `category_backfill` et `sku_ids` : c'est un
   synchroniseur de catalogue. HTTP 400 au premier essai réel, sur un schéma
   jamais vérifié.
2. **La page de recherche de HLJ ne publie pas ses résultats.** Essai réel :
   HTTP 200, 218 000 caractères, **zéro** bloc `application/ld+json`, zéro
   lien produit. Les résultats sont rendus par le navigateur. Aucune lecture
   de HTML — schema.org ou classes CSS — ne peut donc les atteindre.
3. **HLJ ne publie pas d'API de recherche.** Le seul point d'entrée public
   connu, `/search/livePrice/?item_codes=…`, rend des prix pour des références
   qu'on lui donne : il ne cherche pas.

Il faut donc exécuter la page. Le faire chez nous supposerait un navigateur
sans interface dans le serveur — lourd en local, hors budget mémoire sur
Vercel, et un scraper CSS maison à réparer chaque fois que HLJ change son
HTML. Un acteur dédié existe déjà et c'est son auteur qui le maintient : c'est
la solution la moins chère à garder en état, ce qui est le critère ici.

Coût indicatif : de l'ordre de 0,02 $ par mot-clé cherché, facturé par Apify.
La recherche restant à la demande, cela se compte en recherches réellement
faites par l'atelier.

### Changer de source sans toucher au code

L'acteur par défaut n'est pas écrit en dur. Deux variables le remplacent :

```
HLJ_APIFY_ACTOR=jpmarketdata/hlj-hobby-market-checker
HLJ_APIFY_INPUT={"keyword":"{q}","maxItems":{limit}}
```

`HLJ_APIFY_INPUT` est l'entrée JSON **telle que la documentation de l'acteur la
décrit**, avec trois marques remplacées à l'appel : `{q}` le terme (échappé
pour du JSON), `{limit}` le nombre de résultats, `{url}` la page de recherche
HLJ. C'est la leçon du HTTP 400 : l'entrée d'un acteur appartient à sa
documentation, pas à nos suppositions.

Si un jour un endpoint JSON est constaté, il passe devant l'acteur — une
requête vaut mieux qu'un navigateur :

```
HLJ_SEARCH_API=https://…/search?q={q}&limit={limit}
```

Réglages accessoires :

```
HLJ_USER_AGENT=MediaromCatalogBot/1.0 (+https://…)   # identification
HLJ_ENRICH_DETAILS=1                                 # ouvrir les fiches détaillées
HLJ_SEARCH_URL=https://www.hlj.com/search/?Word={q}  # page lue par --discover
```

`HLJ_ENRICH_DETAILS` est **désactivé par défaut**, et volontairement : l'acteur
rend déjà fabricant et GTIN, et rien ne prouve que les fiches produit de HLJ
publient des données structurées — la page de recherche n'en publie aucune.
Activé, l'import ouvre au plus douze fiches, quatre à la fois, et complète ce
qui manque. Jamais tout le catalogue.

### Vérifier

```bash
npm run check:hlj -- "luffy gear 5"
npm run check:hlj -- "luffy gear 5" --raw        # + la fiche telle qu'elle sera importée
npm run check:hlj -- "luffy gear 5" --discover   # HLJ appelle-t-il une API ?
```

Sans option, le script fait **exactement** ce que fait l'écran d'import : même
provider, même requête, même limite (`SEARCH_LIMIT`, défini une seule fois dans
`lib/catalog/providers/types.ts`), même lecture. Il ne peut donc pas passer
pendant que l'écran échoue — c'est précisément ce qui s'était produit avec la
première version.

Ce qu'il répond, et ce que ça veut dire :

| Sortie | Cause | Correction |
| --- | --- | --- |
| `a besoin de APIFY_TOKEN` | Pas de jeton | Le poser dans `.env.local` |
| `HTTP 401` / `HTTP 403` | Jeton refusé | Vérifier le jeton sur apify.com |
| `HTTP 404` | Acteur introuvable | Vérifier `HLJ_APIFY_ACTOR` |
| `HTTP 400` | Entrée refusée | Comparer `HLJ_APIFY_INPUT` à la doc de l'acteur |
| `0 élément(s) reçus` | L'acteur n'a rien trouvé | Essayer un terme plus court |
| `n élément(s), 0 lisible(s)` | Champs inattendus | Lancer avec `--raw` et ajuster |

`--discover` répond à une seule question : la page de HLJ appelle-t-elle un
endpoint JSON qu'on pourrait interroger directement, sans acteur ni coût ? Il
lit la page, suit ses bundles JavaScript et rapporte les endpoints, moteurs de
recherche et clés publiques qu'il y trouve. Si oui, `HLJ_SEARCH_API` évite
l'acteur. Sinon, il n'y a rien à faire : c'est déjà le bon chemin.

### Ce qu'il faut savoir avant de s'en servir

La recherche interroge un site tiers, par l'intermédiaire d'Apify. Elle est
ponctuelle — un appel par recherche, déclenché par un clic —, et ne copie rien
en masse. Vérifiez tout de même les conditions d'utilisation de HobbyLink Japan
et son `robots.txt` avant un usage régulier : ce point n'a pas pu être contrôlé
depuis l'environnement de développement, qui n'atteint ni `hlj.com` ni
`apify.com`.

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
