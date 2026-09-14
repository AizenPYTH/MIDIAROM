# Accueil — charte v5

Porté depuis `207_MEDIROME_Accueil.dc.html` (référence visuelle de Claude
Design), avec les tokens et le tableau Motion du handoff v4. **Le `.dc.html`
n'est pas dans le dépôt** : c'est une maquette qui tourne sur un runtime de
prototypage (`support.js`, `<sc-for>`, `{{ }}`) qu'il ne faut pas importer.

## Le point à ne pas défaire

> Le récit de réparation, la bascule et la scène jeux reposent sur
> `position: sticky` + `animation-timeline: view()` **en CSS**, avec un repli
> `@supports not`.

C'est délibéré, et ce n'est pas interchangeable avec des épinglages GSAP : la
chorégraphie ne dépend alors d'**aucun cycle de vie JavaScript**. Rien à
monter, rien à rafraîchir au redimensionnement, rien à perdre si un script
tarde ou échoue. Tout état masqué vit dans le `@supports` : sans prise en
charge des chronologies de défilement, la page redevient un flux vertical
entièrement visible.

Le JavaScript de l'accueil ne fait que ce que le CSS ne sait pas faire :

| Fait par le CSS (`app/globals.css`) | Fait par le JS |
| --- | --- |
| Fonds et panneaux de la scène jeux | Compteur « 03 / 05 » |
| Voile de la bascule, temps du récit | Jaquette active et son centrage |
| Barres de progression, révélations | Chargement et lecture de la vidéo |
| Respiration des artworks | Ouverture de la bande-annonce |

## Les scènes, dans l'ordre

| Section | Fichier | Hauteur |
| --- | --- | --- |
| Hero réparation | `components/marketing/home/scenes.tsx` | 100svh |
| Récit de l'atelier, 4 temps | idem, `StoryScene` | 420svh |
| Ce qui passe sur le banc | `home/shop-sections.tsx`, `ServicesGrid` | auto |
| Bascule réparation → boutique | `scenes.tsx`, `ShiftScene` | 250svh |
| Entrée boutique | `scenes.tsx`, `ShopIntro` | auto |
| Jeu du moment | `home/featured-game.tsx` | 300svh (plateau épinglé 100svh) |
| Derniers jeux | `home/games-scene.tsx` | 520svh (420 sous 900px) |
| Le reste de la sélection | `home/games-grid.tsx` | auto |
| Consoles / figurines / accessoires | `home/shop-sections.tsx`, `ShopRows` | auto |

## Données

Tout vient du catalogue, jamais d'IGDB au moment de l'affichage :

```
products (category = GAME)
   ↓ getHomepageGames()      lib/shop/games.ts
GameListing                  visuels déjà choisis selon leur usage
   ↓ toGameScenes()          lib/shop/game-scene.ts  → les 5 panneaux animés
   ↓ toGameGrid()            idem                    → le reste, en grille
GameScene                    + étiquette, lueur, ligne méta, href de la fiche
   ↓
FeaturedGame · GamesScene · GamesGrid   ne connaissent ni IGDB ni la base
```

`GAME_SCENE_SLOTS` vaut **5** : la chorégraphie CSS découpe la scène en cinq
segments (`:nth-child(1..5)`). Un sixième panneau n'aurait aucune plage
d'animation et resterait invisible. Les jeux suivants ne sont pas jetés pour
autant : `toGameGrid()` les rend sous la scène, en grille (`GamesGrid`), pour
que la sélection paraisse ce qu'elle est — un rayon — sans toucher à la
chorégraphie.

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

Dès qu'**un seul** jeu entre au catalogue, la vitrine s'efface entièrement.
Pour la supprimer définitivement : effacer `lib/shop/demo-games.json` et l'appel
dans `lib/shop/games.ts`. Rien d'autre n'en dépend.

Les identifiants IGDB ne sont pas écrits à la main — ils seraient faux, et un
identifiant inventé donne un 404 à la place de la jaquette. Le fichier est
produit par un script, depuis une liste de titres :

```bash
npm run demo:games            # interroge IGDB, écrit lib/shop/demo-games.json
npm run demo:games -- --clear # retire la vitrine
```

Il a besoin de `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` dans
l'environnement, comme le reste de l'intégration IGDB.

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
| Aucun jeu au catalogue | Scène et vedette masquées, message clair, lien vers `/boutique` |
| Image absente ou CDN muet | `SafeImage` bascule sur l'aplat de la charte, jamais d'icône cassée |
| Pas d'artwork | Aplat teinté de la lueur du jeu |
| Vidéo absente ou en échec | L'artwork reste, la vidéo garde une opacité nulle |
| Rayon consoles / figurines vide | La section ne s'affiche pas du tout |
| `prefers-reduced-motion` | La scène redevient une liste, tout est visible, aucune vidéo |
| Pas de `animation-timeline` | Flux vertical, rien de superposé, rien d'invisible |
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
