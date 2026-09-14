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
| Jeu du moment | `home/featured-game.tsx` | 92svh |
| Derniers jeux | `home/games-scene.tsx` | 520svh (420 sous 900px) |
| Consoles / figurines / accessoires | `home/shop-sections.tsx`, `ShopRows` | auto |

## Données

Tout vient du catalogue, jamais d'IGDB au moment de l'affichage :

```
products (category = GAME)
   ↓ getHomepageGames()      lib/shop/games.ts
GameListing                  visuels déjà choisis selon leur usage
   ↓ toGameScenes()          lib/shop/game-scene.ts
GameScene                    + étiquette, lueur, ligne méta, href de la fiche
   ↓
FeaturedGame · GamesScene    ne connaissent ni IGDB ni la base
```

`GAME_SCENE_SLOTS` vaut **5** : la chorégraphie CSS découpe la scène en cinq
segments (`:nth-child(1..5)`). Un sixième panneau n'aurait aucune plage
d'animation et resterait invisible — la liste est donc bornée ici plutôt que de
laisser un jeu muet au milieu du rail.

Chaque produit présenté mène à sa **vraie fiche** (`/boutique/<slug>`) : titre,
bouton, jaquette, ligne console, carte figurine. Aucun lien mort, aucune ancre
de remplacement. Les seules ancres `#boutique` sont celles du récit, vers une
section réellement présente sur la page.

## Vidéo de fond

Deux sources distinctes, volontairement :

- **`video`** vient du produit (`hero_video_url`, `hero_video_poster_path`),
  saisi dans le back-office. C'est la seule vidéo utilisable en fond, parce que
  c'est la seule dont l'atelier dispose légalement.
- **`trailerUrl`** vient d'IGDB : une référence YouTube, ouverte à la demande
  dans une modale. L'iframe n'existe qu'à l'ouverture ; rien n'est téléchargé
  ni réhébergé.

Comportement du fond : `video.url` présent → vidéo, artwork dessous en
attendant ; sinon artwork ; sinon aplat teinté de la lueur du jeu. La vidéo est
en `preload="none"`, ne se charge qu'à l'entrée de la section, reste muette, se
coupe hors champ et en onglet masqué, et **ne se charge pas** sous
`prefers-reduced-motion` ni sous 900px — l'affiche prend le relais.

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

## Tester les cas

```bash
npm run fixtures:homepage -- up      # cinq jeux couvrant tous les cas
npm run fixtures:homepage -- empty   # catalogue vide
npm run fixtures:homepage -- status
```

Ce ne sont pas des données de production : préfixe de SKU `DEMO-HP-`, et `down`
les retire toutes.
