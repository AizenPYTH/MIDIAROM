# Back-office

## Par où on entre

`/admin` répond à une seule question : **qu'est-ce que vous voulez faire ?**

1. **Mettre en vente** — quatre cartes : un jeu vidéo, une console, une
   figurine, une réparation.
2. **Ce qui vous attend** — réparations en cours, commandes à préparer,
   reprises à évaluer, articles en brouillon. Chaque ligne porte son compte,
   lu en base.
3. **Tout le back-office** — l'index complet, en clair, groupé par métier.

Avant, `/admin` ouvrait directement la file de l'atelier et **toute** la
navigation vivait dans un menu « Plus ». Comme la barre ne portait aucun onglet,
ce bouton restait collé à gauche et son panneau de 560 px s'ouvrait vers la
gauche — hors de l'écran. On pouvait tenir le site sans jamais trouver l'import
de figurines. La file de l'atelier est maintenant à `/admin/atelier`, et la
barre porte cinq onglets permanents : Accueil · Atelier · Commandes · Articles ·
Tarifs.

## Publier une annonce

**`/admin/annonces/nouvelle`** — six champs :

| Champ | Pourquoi il est demandé |
| --- | --- |
| Rayon | Jeux vidéo · Consoles · Figurines Manga / Anime |
| Nom | — |
| Plateforme *(ou licence pour une figurine)* | La colonne est obligatoire en base, et l'exemple s'adapte au rayon |
| État | Neuf, révisé, occasion A/B/C |
| Prix | Accepte `49,90`, `49.90`, `129,50 €` |
| Quantité | 1 par défaut |

Tout le reste est fabriqué : la **référence** (`FIG-260915-LUFFY-K3P9` — rayon,
date, premier mot, tirage aléatoire), le **slug** de la fiche publique, le seuil
de stock, l'ordre d'affichage. Le formulaire complet à vingt-sept champs existe
toujours : il s'ouvre juste après, quand il y a enfin quelque chose à y mettre
— photos, caractéristiques, fiche IGDB, mouvements de stock.

**L'article n'est pas en ligne par défaut.** Il lui manque ses photos, et une
fiche sans photo se vend mal. Une case permet de publier immédiatement : c'est
le magasin qui décide.

`lib/catalog/listing.ts` porte les deux seules étapes qui peuvent se tromper en
silence — lire un prix, fabriquer une référence — et `tests/listings.test.ts`
les couvre. Un prix mal lu entre en base sans erreur ; une référence non unique
fait échouer le deuxième article de la journée.

## Importer une figurine

**`/admin/catalog/figurines`**, accessible en un clic depuis l'accueil et depuis
le menu. Recherche chez HobbyLink Japan, création en brouillon. Il faut
`APIFY_TOKEN` : sans lui, la page affiche quoi faire au lieu d'échouer. Voir
`docs/FIGURINES.md`.

## Ce que fait quoi

| Écran | Pour |
| --- | --- |
| `/admin/atelier` | La file de réparation : diagnostic, devis, atelier, retour |
| `/admin/shop-orders` | Commandes boutique à préparer, expédier, remettre |
| `/admin/stock` | Tous les articles : prix, stock, photos, mise en ligne |
| `/admin/catalog/*` | Les tarifs de réparation : marques, consoles, pannes, prestations |
| `/admin/trade-ins` | Reprises : offres à faire, consoles reçues |
| `/admin/settings` | Nom, adresse, horaires, garantie, livraison — ce que le site public affiche |
| `/admin/content` | Textes, FAQ, mentions légales, galerie |

## Ce qui reste à faire

Le formulaire long (`/admin/stock/[id]`) est encore une liste plate de
vingt-sept champs. Il est le bon outil pour ajuster une fiche, pas pour en
créer une — c'est ce que le formulaire court corrige. Le regrouper en sections
serait le prochain pas utile.
