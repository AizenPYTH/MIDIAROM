# Accueil

## Ce que la page doit faire comprendre

Dans cet ordre, et en quelques secondes :

1. **MÉDI@ROM répare vos consoles.**
2. **MÉDI@ROM tient une boutique gaming et pop culture** — jeux vidéo,
   consoles, figurines, manga & anime.

Tout le reste est au service de ces deux phrases.

## Le point à ne pas défaire

La page portait **quatre scènes épinglées totalisant près de 1500svh** : récit
en quatre temps relayés, rail de jaquettes à cinq panneaux, jeu vedette avec
masque et parallaxe, plus une jauge de lecture et un bandeau de mots géants.
C'était une démonstration de savoir-faire : on scrollait très longtemps pour
peu de contenu.

Il ne reste que **deux moments animés**, parce qu'ils disent quelque chose :

| Moment | Ce qu'il apporte | Coût |
| --- | --- | --- |
| Volet avant / après | Il montre le métier | Aucune hauteur ajoutée, animé à l'entrée |
| Bascule atelier → boutique | Il fait changer d'univers | 180svh, **la seule scène épinglée** |

Plus une révélation discrète à l'entrée des blocs (`[data-reveal]`), une pose
d'artwork sur le jeu vedette, et un `card-lift` au survol des cartes. Rien
d'autre. La page fait **environ 10 écrans** au lieu d'une vingtaine.

**La règle, pour la suite** : avant d'ajouter une animation, répondre à « est-ce
que ça améliore la compréhension ou l'émotion ? ». Si la réponse n'est pas
évidente, ne pas l'ajouter. Une animation forte vaut mieux que cinq moyennes.

Le choix du CSS plutôt que d'un pin JavaScript est inchangé : `position: sticky`
+ `animation-timeline` ne dépend d'aucun cycle de vie, il n'y a rien à monter ni
à rafraîchir au redimensionnement. Voir `app/globals.css`.

**Piège vérifié** : un ancêtre en `overflow: hidden` devient un conteneur de
défilement, et `animation-timeline: view()` s'y accroche au lieu de la page —
les révélations restent alors figées à mi-course. Le jeu vedette en souffrait ;
le découpage se fait désormais sur le cadre de l'artwork, pas sur la section.

## Les sections, dans l'ordre

| Section | Fichier | Hauteur |
| --- | --- | --- |
| Hero réparation | `home/scenes.tsx`, `HeroRepair` | 100svh |
| Ce qui passe sur le banc | `home/shop-sections.tsx`, `RepairServices` | auto |
| L'atelier en quatre temps + volet avant/après | `home/scenes.tsx`, `RepairFlow` | auto |
| **Bascule atelier → boutique** | `home/scenes.tsx`, `ShiftScene` | 180svh, épinglée |
| La boutique : quatre rayons | `home/shop-sections.tsx`, `ShopCategories` | auto |
| Le jeu du moment | `home/featured-game.tsx` | ≤ 92svh |
| Jeux vidéo | `home/games-grid.tsx` | auto |
| Consoles · Figurines · Manga & Anime | `home/shop-sections.tsx`, `ProductRail` | auto |
| Devis | `app/(marketing)/page.tsx` | auto |

## La boutique

Quatre rayons, et seulement quatre — la boutique est **gaming et pop culture**,
pas un magasin d'électronique généraliste :

| Rayon | Catégorie | Filtre |
| --- | --- | --- |
| Jeux vidéo | `GAME` | `/boutique?cat=jeux` |
| Consoles | `CONSOLE` | `/boutique?cat=consoles` |
| Figurines | `COLLECTIBLE` | `/boutique?cat=figurines` |
| Manga & Anime | `MANGA` | `/boutique?cat=manga` |

`MANGA` a été ajouté à l'énumération `product_category`
(`supabase/migrations/20260915000001_manga.sql`) : sans elle, le manga se serait
confondu avec les collectors.

**Pas de PC ni de smartphones en rayon.** L'atelier les répare toujours — le
parcours de devis les propose — mais ce ne sont pas des catégories
commerciales, et les mettre en avant brouillerait ce que le magasin vend.

Le rayon « Jeux vidéo » de l'accueil est **`GamesGrid`**, pas un `ProductRail` :
qu'il montre du vrai stock ou la vitrine de démonstration, il n'y a qu'un seul
bloc jeux, jamais deux.

## Tout est en français

IGDB ne sert que de l'anglais. `lib/shop/game-fr.ts` traduit ce qui se traduit —
un vocabulaire fermé, court, vérifiable — et **écarte** ce qu'il ne connaît pas
plutôt que de laisser passer un mot anglais.

- Les **genres** sont traduits ; un genre inconnu est retiré de la ligne.
- Les **plateformes** sont raccourcies (`PC (Microsoft Windows)` → `PC`) ; les
  marques restent intactes.
- Les **résumés IGDB ne sont jamais affichés** pour une fiche de démonstration.
  Ils sont en anglais, et on ne va pas inventer une traduction ni un texte
  promotionnel qu'aucune source n'a écrit. La ligne de métadonnées
  (genre · année · studio) dit ce qu'il faut savoir, en français.
- Les **titres de jeux** ne se traduisent pas : ce sont des noms commerciaux.

`tests/game-fr.test.ts` verrouille cette frontière.

## Données

Tout vient du catalogue, jamais d'IGDB au moment de l'affichage :

```
products (category = GAME)
   ↓ getHomepageGames()      lib/shop/games.ts
GameListing                  visuels déjà choisis selon leur usage
   ↓ toGameScenes()          lib/shop/game-scene.ts
GameScene                    + étiquette, lueur, ligne méta, href de la fiche
   ↓
FeaturedGame · GamesGrid     ne connaissent ni IGDB ni la base
```

Le rayon n'est plus borné : la scène à cinq panneaux a disparu au profit d'une
grille, et c'est l'accueil qui décide combien de jaquettes il montre
(`GAMES_ON_HOME`, trente aujourd'hui).

Chaque produit présenté mène à sa **vraie fiche** (`/boutique/<slug>`) : titre,
bouton, jaquette, ligne console, carte figurine. Aucun lien mort, aucune ancre
de remplacement. Les seules ancres `#boutique` sont celles du récit, vers une
section réellement présente sur la page.

### Vitrine de démonstration

Tant qu'aucun jeu n'est au catalogue, `getHomepageGames()` retombe sur
`lib/shop/demo-games.ts` : une sélection de jeux **réels**, tirés d'IGDB comme
n'importe quelle fiche, pour que l'accueil ne soit pas vide avant la saisie du
stock. Elle est tenue à l'écart du stock, et ça se voit :

- rien n'est créé dans `products` ; ce ne sont pas des produits ;
- `href` vaut `null` — pas de lien vers une fiche qui n'existe pas ;
- pas de prix, et le bouton devient une pastille « Bientôt en rayon » ;
- une mention sous la scène dit que la sélection est une démonstration ;
- `isDemo` porte l'information jusqu'aux composants, qui ne devinent rien.

### Le fichier est importé, pas lu sur le disque

`lib/shop/demo-games.json` est **versionné** (vide par défaut) et **importé**
par `lib/shop/demo-games.ts`. Ce n'est pas un détail : il était auparavant lu
au runtime par `readFile(path.join(process.cwd(), …))`, ce que le traçage de
fichiers de Next ne suit pas. Le JSON n'était donc pas embarqué dans la fonction
serverless, la lecture échouait en silence, et l'accueil déployé restait vide —
sans jeu vedette, donc sans scène, donc **sans vidéo**. Un import statique part
dans le bundle : vérifiable en cherchant un titre dans `.next/server` après un
build.

Conséquence pratique : après `npm run demo:games`, **committer le fichier**.
Sans lui, le déploiement ne sait pas quels jeux afficher. Et comme l'accueil lit
le cache `igdb_games`, il faut aussi que ce cache soit rempli sur la base du
déploiement (voir docs/IGDB.md).

Dès qu'**un seul** jeu entre au catalogue, la vitrine s'efface entièrement.
Pour la supprimer définitivement : effacer `lib/shop/demo-games.json` et l'appel
dans `lib/shop/games.ts`. Rien d'autre n'en dépend.

Les identifiants IGDB ne sont pas écrits à la main — ils seraient faux, et un
identifiant inventé donne un 404 à la place de la jaquette. Le fichier est
produit par un script, depuis une liste de titres :

```bash
npm run demo:games              # interroge IGDB, écrit lib/shop/demo-games.json
npm run demo:games -- --dry-run # résout tout sans rien écrire
npm run demo:games -- --debug   # affiche la requête envoyée et la réponse reçue
npm run demo:games -- --clear   # retire la vitrine
```

Il a besoin de `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` dans
l'environnement, comme le reste de l'intégration IGDB, et envoie exactement la
même requête que `npm run check:igdb` (socle commun dans
`scripts/lib/igdb-cli.mjs`) : si l'une passe, l'autre passe. Voir
docs/IGDB.md pour le diagnostic.

## Vidéo de fond

Deux sources distinctes, volontairement :

- **`video`** vient du produit (`hero_video_url`, `hero_video_poster_path`),
  saisi dans le back-office. C'est la seule vidéo utilisable en fond, parce que
  c'est la seule dont l'atelier dispose légalement.
- **`trailerUrl`** vient d'IGDB : une référence YouTube, ouverte à la demande
  dans une modale. L'iframe n'existe qu'à l'ouverture ; rien n'est téléchargé
  ni réhébergé.

- **`DEMO_FEATURED_VIDEO`** (`lib/content/assets.ts`) est un habillage : une
  boucle fabriquée pour ce projet (animation dessinée sur un canvas puis
  enregistrée, `public/medias/demo/featured-loop.webm`, 561 Ko). Elle n'est
  empruntée à personne. Elle ne sert qu'à défaut de vidéo produit, se superpose
  en `mix-blend-mode: screen` à 50 % — l'artwork reste le sujet — et la mention
  « Habillage — sans son » le dit au visiteur. Aucune vidéo YouTube n'est
  jamais téléchargée ni convertie.

Comportement du fond : `video.url` présent → vidéo, artwork dessous en
attendant ; sinon artwork ; sinon aplat teinté de la lueur du jeu. La vidéo est
en `preload="none"`, ne se charge qu'à l'entrée de la section, reste muette, se
coupe hors champ et en onglet masqué, et **ne se charge pas** sous
`prefers-reduced-motion` ni sous 900px — l'affiche prend le relais.

## Assets

**Aucune photo n'est choisie à la place du magasin.** Les visuels du hero, du
récit, des cartes de service, de l'entrée boutique, des consoles, des figurines
et du manga seront fournis par le client. `lib/content/assets.ts` est donc
volontairement à `null` partout : les emplacements existent dans les
composants, et renseigner un chemin dans ce fichier suffit à les remplir, sans
toucher au code.

Ce qui existe par ailleurs dans le dépôt, non branché sur l'accueil : 13
détourés de consoles sur fond blanc (`public/medias/consoles/`, utilisés par les
fiches de réparation) et la photo de la devanture
(`public/medias/facade-207-mediarom.webp`, publiée dans la galerie).

| Section | Visuel |
| --- | --- |
| Hero réparation, récit, entrée boutique | Aplats animés de la charte, en attente de `HERO_PHOTO` / `STORY_*` / `SHOP_PHOTO` |
| Ce qui passe sur le banc | `PhotoSlot` : lueur de l'accent, trame fine, initiale en filigrane |
| Rayons consoles / figurines | `products.images`, à défaut la photo du modèle lié (`console_models.image_path`), à défaut `PhotoSlot` |
| Jeux, jeu vedette | Covers, artworks et captures **d'IGDB** |

`MISSING_ASSETS`, dans le même fichier, liste ce qui manque et pour quel usage :
c'est la liste à donner au client.

**Ne pas illustrer faux.** Un emplacement sans photo garde sa plaque dessinée —
un état prévu par la charte — plutôt qu'une image approchante. Mettre une Xbox
One sur la carte « Rétro » serait un mensonge visuel ; la règle vaut partout.

## Replis

| Cas | Comportement |
| --- | --- |
| Aucun jeu au catalogue | Vitrine de démonstration, ou message clair et lien vers `/boutique` |
| Image absente ou CDN muet | `SafeImage` bascule sur l'aplat de la charte, jamais d'icône cassée |
| Pas d'artwork | Aplat teinté de la lueur du jeu |
| Vidéo absente ou en échec | L'artwork reste, la vidéo garde une opacité nulle |
| Rayon consoles / figurines vide | La section ne s'affiche pas du tout |
| `prefers-reduced-motion` | Plus rien ne bouge, tout est visible, aucune vidéo |
| Pas de `animation-timeline` | Flux vertical, rien de superposé, rien d'invisible |
| Rayon consoles / figurines / manga vide | La section ne s'affiche pas du tout |
| Catalogue vide mais `demo-games.json` présent | Vitrine de démonstration, sans prix ni lien, annoncée comme telle |
| Catalogue vide et pas de `demo-games.json` | Message clair, lien vers `/boutique` |

## Tester les cas

```bash
npm run fixtures:homepage -- up             # cinq jeux couvrant tous les cas
npm run fixtures:homepage -- up --extra 8  # + 8 jeux, pour éprouver la grille
npm run fixtures:homepage -- empty         # catalogue vide
npm run fixtures:homepage -- status
```

Ce ne sont pas des données de production : préfixe de SKU `DEMO-HP-`, et `down`
les retire toutes.
