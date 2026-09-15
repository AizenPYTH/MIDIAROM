# Back-office

## L'écran

`/admin` répond à une seule question : **qu'est-ce qui attend une action.**

La liste des réparations **est** la page. Le réparateur l'ouvre vingt fois par
jour pour suivre des dossiers, pas pour publier un article : l'ajout au
catalogue tient donc en quatre boutons discrets, en bas de la colonne de
droite. C'est un renversement assumé de la version précédente, qui ouvrait sur
« Qu'est-ce que vous voulez faire ? » et quatre grandes cartes de publication.

| Bloc | Ce qu'il porte |
| --- | --- |
| Ligne d'état | Quatre nombres, chacun un lien qui filtre la liste |
| Réparations en cours | Onglets de filtrage, puis le tableau : Réf. · Client et console · Panne · État · Prix · action |
| À faire maintenant | Déduit de la liste, par ordre d'urgence |
| Commandes boutique | Les quatre dernières, avec leur état |
| Ajouter au catalogue | Un jeu vidéo · Une console · Une figurine · Une prestation |

La barre porte cinq onglets permanents — Accueil · Atelier · Commandes ·
Articles · Tarifs. Avant, elle n'en portait aucun : tout vivait dans un menu
« Plus » qui, sans onglet à sa gauche, ouvrait son panneau de 560 px vers la
gauche, hors de l'écran. On pouvait tenir le site sans jamais trouver l'import
de figurines.

## Les quatre registres

La base connaît vingt-deux statuts ; le réparateur en lit quatre.
`lib/admin/workbench.ts` fait le regroupement **une seule fois**, et c'est lui
qui décide à la fois du traitement visuel et de l'action de la ligne.

| Registre | Statuts | Apparence | Action | Sens |
| --- | --- | --- | --- | --- |
| `diag` | PAID → DIAGNOSIS | blanc, bordure grise | Diagnostiquer | à faire à l'atelier |
| `attente` | WAITING_CUSTOMER_APPROVAL | **rouge** `#fdecec` / `#a8161c` | Relancer | la balle est chez le client |
| `atelier` | APPROVED, REPAIRING, QUALITY_CONTROL | encre pleine | Ouvrir | à faire à l'atelier |
| `prete` | READY_TO_SHIP | gris | Expédier | terminé |

Le statut brut ne remonte jamais jusqu'au rendu. **Chaque ligne porte son
action juste**, pas une flèche identique partout : c'est ce qui rend la liste
utilisable sans réfléchir.

`tests/workbench.test.ts` vérifie qu'aucun statut ne tombe dans deux registres
— sinon la réparation apparaîtrait deux fois et les compteurs cesseraient de
totaliser — et qu'aucun registre ne partage l'action d'un autre.

## Le rouge

**Il ne signale qu'une chose : ce qui dépend du client.** Le compteur des devis
en attente, l'état « Devis envoyé », les puces de relance en retard, les
commandes à expédier, le bouton « Nouvelle réparation ». Nulle part ailleurs —
sinon il ne signale plus rien.

## Rien n'est inventé

Chaque nombre est compté en base. « À faire maintenant » se déduit de la liste :
les relances de deux jours ou plus, les plus anciennes d'abord, puis les colis
à préparer, puis les consoles à ouvrir. Un bloc sans donnée le dit — « Rien
n'attend d'action. L'atelier est à jour. » — plutôt que d'afficher un tiret.

Aucun indicateur décoratif : ni taux de satisfaction, ni courbe de chiffre
d'affaires.

## Publier une annonce

**`/admin/annonces/nouvelle`** — le formulaire court :

| Champ | Note |
| --- | --- |
| Rayon | Jeux vidéo · Consoles · Figurines Manga / Anime |
| Nom | — |
| Plateforme *(ou licence pour une figurine)* | L'exemple s'adapte au rayon |
| État | Neuf, révisé, occasion A/B/C |
| Prix | Accepte `49,90`, `49.90`, `129,50 €` |
| Quantité | 1 par défaut |
| **Photos** | Choix de fichiers, envoi, vignettes, réordonnable |

Le formulaire complet en compte vingt-sept, dont un SKU et un slug à inventer
soi-même. Ici, la **référence** (`FIG-260915-LUFFY-K3P9`), le **slug** de la
fiche publique, le seuil de stock et l'ordre d'affichage sont fabriqués.

Les photos montent dans le bucket `content-media` et leurs chemins voyagent
dans des champs cachés. Ils viennent donc du navigateur : l'action ne garde que
ce qui a la forme d'un objet du bucket, jamais une URL absolue qui ferait
afficher une image d'un autre domaine sur la fiche produit
(`tests/listings.test.ts`). La première photo est la vignette du rayon.

L'ancien téléverseur rendait un **chemin à copier-coller** dans un champ texte ;
autant dire qu'on ne mettait pas de photo, et un article sans visuel ne se vend
pas.

**L'article n'est pas en ligne par défaut.** Une case permet de publier
immédiatement : c'est le magasin qui décide.

## Où va le reste

| Écran | Pour |
| --- | --- |
| `/admin/atelier` | La vue maître/détail : diagnostic, devis, expédition dans un seul volet |
| `/admin/orders/[id]` | La fiche complète d'une réparation |
| `/admin/shop-orders` | Commandes boutique |
| `/admin/stock` | Tous les articles : prix, stock, photos, mise en ligne |
| `/admin/catalog/*` | Tarifs de réparation : marques, consoles, pannes, prestations |
| `/admin/catalog/figurines` | Import HobbyLink Japan — voir `docs/FIGURINES.md` |
| `/admin/settings` | Nom, adresse, horaires, garantie, livraison |

## Tokens

Ceux du site public. Fond d'application `#f4f4f6`, panneaux blancs, angles nets,
aucune ombre, Archivo + IBM Plex Mono.

La géométrie des deux colonnes vit dans `globals.css` (`[data-split]`), jamais
en style en ligne : un style en ligne l'emporterait sur la requête de média et
la colonne de droite resterait à 340 px sur un téléphone.

Le survol du back-office utilise `data-arow`, et non `data-row` : le site public
décale ses lignes de 10 px au survol, ce qui ferait sauter les cellules d'un
tableau.

## Ce qui reste à faire

Le formulaire long (`/admin/stock/[id]`) est encore une liste plate de
vingt-sept champs. Il est le bon outil pour ajuster une fiche, pas pour en créer
une — c'est ce que le formulaire court corrige. Le regrouper en sections serait
le prochain pas utile.
