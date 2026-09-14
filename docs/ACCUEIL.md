# Accueil

Un atelier de réparation de consoles à Marseille, **et** la boutique qui va
avec. L'ordre de la page est la promesse du site et ne se négocie pas.

## Les blocs, dans l'ordre

| # | Bloc | Composant | Source |
| --- | --- | --- | --- |
| 1 | Bandeau utilitaire + en-tête | `components/marketing/header.tsx` | `UTILITY_BAR`, `getBrandSettings()` |
| 2 | Hero compact + identité gaming | `Hero` | `content.ts` |
| 3 | Pannes par console, avec prix | `Repairs` | `PLATFORMS` |
| 4 | Parcours en cinq temps, fond noir | `Journey` | `STEPS` |
| 5 | Bande de confiance | `TrustBand` | `TRUST` |
| 6 | Savoir-faire + vidéo d'atelier | `Workshop` | `SAVOIR_FAIRE`, `WORKSHOP_VIDEO` |
| 7 | Les trois rayons | `ShopCategories` | `CATEGORIES` |
| 8 | Mur de produits + filtres | `ProductWall` | `getProducts()`, `getProductCategoryCounts()` |
| 9 | Le magasin | `Store` | `getBrandSettings()` |
| 10 | Pied de page | `components/marketing/footer.tsx` | `brand`, `social`, modèles réparables |

Les blocs 2 à 9 vivent dans `components/marketing/home/sections.tsx`.

## Ce qui ne se défait pas

**Consoles uniquement.** L'atelier ne répare ni téléphone, ni ordinateur, ni
tablette. C'est écrit noir sur blanc dans l'encadré sous les cartes de
plateforme, et `tests/home-sections.test.tsx` vérifie qu'aucune autre mention
ne le contredit.

**Trois rayons, pas quatre.** Jeux vidéo · Consoles · Figurines manga / anime —
des **figurines de personnages**, jamais des livres manga. Le libellé visible du
rayon est « Figurines Manga / Anime » (`lib/shop/status.ts`).

**Réparation d'abord, boutique ensuite.** La réparation occupe le plus de
surface parce que c'est le métier principal ; les produits restent atteignables
en deux gestes de défilement.

**Aucun chiffre inventé.** Pas de note moyenne, pas de nombre d'avis, pas de
volume de consoles réparées. Il n'y a pas de bloc d'avis tant qu'il n'y a pas de
vrais avis.

## Les tarifs affichés

⚠️ **Les prix et délais de `components/marketing/home/content.ts` sont les
valeurs de travail du handoff, pas des tarifs validés.** Le cahier des charges
métier n'était pas dans le projet au moment de l'implémentation. Toute valeur
qui en vient les remplace — en particulier le prix du diagnostic, les délais par
intervention et la durée de garantie.

Ce sont des repères de vitrine. Le parcours de devis réel, lui, calcule ses prix
depuis la base (`lib/repair/catalog.ts`), et **chaque ligne de panne mène à ce
parcours** : un visiteur ne peut pas commander sur la foi du chiffre affiché.

## L'identité gaming du hero

Trois détails, **tous à l'intérieur du cadre du visuel** — jamais sur le titre
ni sur les boutons, pour ne pas rendre un CTA moins cliquable :

- `data-scan` — un balayage rouge de 2 px, boucle de 7,5 s : la lecture d'un
  banc de test ;
- `data-pad` — une croix directionnelle de cinq carrés de 7 px dont les touches
  s'allument à tour de rôle ;
- `data-hud-dot` — un témoin rouge qui clignote en `steps(1)` sous « Diagnostic
  en cours ».

Les deux premiers disparaissent sous 700px ; le HUD reste. Tout est coupé par
`prefers-reduced-motion`.

## La vidéo d'atelier

`components/marketing/home/workshop-video.tsx`. Trois règles portent sa
conception :

1. **Rien ne se télécharge tant que la section n'est pas atteinte** :
   `preload="none"`, et la `src` n'est écrite dans le DOM qu'au premier ordre de
   lecture.
2. **Elle s'arrête en sortant de l'écran** : `IntersectionObserver` à seuil 0,4.
3. **Elle n'est jamais bloquante** : sans `src`, le cadre reste son image
   d'attente et le bouton disparaît ; sans mouvement autorisé, rien ne démarre
   seul.

Toujours muette, sans commande de son. Pour la brancher, une ligne dans
`lib/content/assets.ts` :

```ts
export const WORKSHOP_VIDEO = { src: "/medias/atelier.mp4", poster: "/medias/atelier.jpg" };
```

Attendu : MP4 H.264 **et** WebM, 1920×1080, 20 à 40 s, moins de 6 Mo, sans piste
sonore. Plans utiles : console ouverte, nettoyage, microsoudure au fer, test
HDMI à l'écran, fermeture du boîtier.

## Les photos

Aucune n'est branchée, et c'est volontaire : le magasin fournira les siennes.
Chaque emplacement affiche la plaque d'attente de la charte (`PhotoSlot`), qui
est un état prévu et non un trou. La liste de ce qui est attendu, avec cadrage
et format, est dans `MISSING_ASSETS` (`lib/content/assets.ts`).

**Les figurines exigent des visuels de personnages** de manga et d'anime.

Seule exception : les jaquettes de jeux, qui viennent du cache IGDB.

## Le mur de produits

Huit produits réels, tous rayons confondus, triés par arrivée. Les filtres
mènent au catalogue réel avec leur requête (`?cat=`, `?etat=`, `?max=`) : un
filtre qui ne filtre rien serait pire qu'absent.

Si le catalogue est vide, la sélection IGDB prend le relais — mêmes cartes,
badgées « Démo », prix annoncé indicatif, **aucun bouton d'ajout au panier**.
Un vrai produit et une fiche de démonstration ne se mélangent jamais dans la
même grille : le visiteur doit toujours savoir lequel il peut acheter.

Rien en rayon et rien en démonstration : la page le dit en une phrase, plutôt
que d'afficher une grille de cadres vides.

## Les réglages qui font disparaître un bloc

Adresse, horaires, téléphone et réseaux sociaux viennent de
`site_settings`. **Une valeur absente ne laisse pas de ligne vide : son élément
n'existe pas.** `tests/home-sections.test.tsx` le vérifie sur le bloc magasin.

## Tester

```bash
npm test                     # dont tests/home-sections.test.tsx
npm run dev                  # puis http://localhost:3000
```

Les cas qui méritent un coup d'œil : catalogue plein · catalogue vide (la
sélection IGDB prend le relais) · base injoignable (tout retombe sur les états
vides) · `WORKSHOP_VIDEO` renseignée et non renseignée · réglages `brand` vides ·
`prefers-reduced-motion` actif.

Largeurs vérifiées sans débordement horizontal : **390, 760, 924, 1100, 1380 px**.
