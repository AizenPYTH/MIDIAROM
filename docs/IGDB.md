# IGDB — fiches de jeux vidéo

Enrichit les produits de catégorie **Jeu** avec les données et les visuels
d'[IGDB](https://www.igdb.com). Facultatif : sans configuration, le site
fonctionne et les produits s'affichent avec leurs propres photos.

## Le principe qui gouverne tout

> **Afficher une page ne déclenche jamais d'appel à IGDB.**

Vingt cartes sur l'accueil = deux requêtes vers notre base, zéro vers IGDB. Le
réseau n'est sollicité que par le back-office (recherche, resynchronisation).
Le quota IGDB est de quatre requêtes par seconde pour toute l'application :
le brûler à l'affichage rendrait le site inutilisable dès la première pointe
de trafic.

```
produit (boutique)
   ↓ igdb_game_id
cache igdb_games (fiche normalisée)
   ↓ lib/shop/games.ts
GameListing  →  accueil
```

La synchronisation, elle, va dans l'autre sens et passe par le back-office :

```
produit  →  indices (nom, EAN, plateforme, édition, année)
         →  recherche IGDB
         →  candidats notés (lib/igdb/match.ts)
         →  validation humaine
         →  igdb_game_id + fiche en cache
```

## Configuration

| Variable | Rôle |
| --- | --- |
| `TWITCH_CLIENT_ID` | Identifiant d'application Twitch |
| `TWITCH_CLIENT_SECRET` | Secret — **serveur uniquement** |

IGDB s'authentifie par Twitch OAuth (client credentials). Créez une application
sur <https://dev.twitch.tv/console/apps>, puis posez les deux variables chez
l'hébergeur et redéployez.

Il n'existe **aucune** variable `NEXT_PUBLIC_TWITCH_*` ni `NEXT_PUBLIC_IGDB_*`,
et il ne doit jamais en exister : tout ce qui porte ce préfixe est inliné dans
le JavaScript envoyé au navigateur. Le jeton d'accès ne quitte pas le serveur,
et aucun journal n'imprime les identifiants (voir `lib/igdb/client.ts`, qui ne
journalise que le code HTTP d'un refus d'authentification).

Tester la connexion :

```bash
npm run check:igdb                # authentification seule
npm run check:igdb -- "zelda"     # + une vraie recherche
```

## Les fichiers

| Fichier | Rôle |
| --- | --- |
| `lib/igdb/types.ts` | Réponses IGDB **et** modèle interne `Game`. La frontière est ici. |
| `lib/igdb/client.ts` | Jeton Twitch (mis en cache), requêtes APIcalypse, délais, quota |
| `lib/igdb/normalize.ts` | IGDB → `Game`. **Seul fichier qui connaît le format IGDB.** |
| `lib/igdb/match.ts` | Choix du bon jeu : plateforme, édition, année, score |
| `lib/igdb/service.ts` | Cache d'abord, réseau ensuite : `getGame`, `getGames`, `searchGameMatches`, `syncGame`, `linkProductToGame` |
| `lib/shop/games.ts` | `GameListing` : ce que l'accueil consomme |
| `app/api/games/search` | Recherche IGDB — **réservée à l'atelier** |
| `app/api/games/[id]` | Fiche normalisée en cache — publique, lecture seule |
| `components/admin/game-match.tsx` | Écran d'association |
| `app/admin/actions/games.ts` | Associer, dissocier, resynchroniser |

Aucun composant d'affichage n'importe quoi que ce soit de `lib/igdb/` :
ils reçoivent un `GameListing` et ignorent d'où il vient.

## Associer un jeu à un produit

1. **Back-office → Stock → un produit de catégorie « Jeu »**.
2. Section « Fiche du jeu (IGDB) » → **Chercher**.
3. Chaque candidat affiche son score et **pourquoi** : titre, plateforme,
   édition, année. Une fiche d'une autre plateforme est signalée en toutes
   lettres (« Plateforme PS5 ABSENTE de la fiche »).
4. **Confirmer ce jeu**. L'association est marquée `MANUAL`.
5. **Dissocier** à tout moment : le produit garde ses propres photos.

### Éviter les mauvaises jaquettes

C'est le risque principal : associer « FIFA 23 PS4 » à la fiche PS5. Le score
se compose ainsi (`lib/igdb/match.ts`) :

| Critère | Poids |
| --- | --- |
| Similarité du titre, mentions d'édition retirées | 0 à 0,60 |
| Plateforme présente / absente / inconnue | −0,50 à +0,30 |
| Édition concordante (Remastered, Deluxe…) | +0,08 |
| Année de sortie proche | +0,07 |

Au-dessus de **0,82**, la correspondance est dite sûre. Une plateforme qui
contredit celle du produit fait tomber sous le seuil : l'association devient
alors un choix humain, jamais un automatisme.

Un **EAN** reconnu par IGDB court-circuite tout et vaut 1,00 : un code-barres
désigne une édition précise sur une plateforme précise.

Renseigner la plateforme du produit est donc la meilleure protection contre
une mauvaise jaquette — sans elle, rien ne départage les versions.

## Cache

`igdb_games` stocke la fiche **déjà normalisée**, pas la réponse brute : c'est
ce que le site lit, et cela évite de retraduire à chaque affichage.

- Fraîcheur : **30 jours**. Au-delà, `syncGame` rafraîchit.
- Forcer : bouton **Resynchroniser** sur la fiche produit.
- Vider le cache ne supprime aucun produit : la clé étrangère est
  `on delete set null`, l'association tombe, le produit reste.

## Images

Les visuels restent servis par le CDN d'IGDB (`images.igdb.com`, déclaré dans
`next.config.ts`). Nous stockons l'`image_id`, jamais une URL figée : n'importe
quelle taille se reconstruit à la demande.

| Usage | Source | Fonction |
| --- | --- | --- |
| Carte produit | `cover` | `cardImage()` |
| Grande section / hero | `artwork`, sinon capture | `heroImage()` |
| Galerie | `screenshots` | — |

Ordre de repli quand IGDB n'a rien : **photos du produit**, puis l'affichage
pose son propre aplat. Aucun de ces cas n'est une erreur.

Nous ne recopions pas les visuels IGDB pour constituer une base autonome : ce
serait contraire à leurs conditions. Le champ `image_id` permettrait d'en
archiver certains dans notre Storage si un besoin précis l'exigeait, sans rien
changer à l'affichage.

## Vidéo / bande-annonce

Deux choses distinctes, volontairement :

- **`trailerUrl`** vient d'IGDB : une référence YouTube et sa vignette
  officielle. Rien n'est téléchargé ni réhébergé, aucune restriction n'est
  contournée.
- **`video`** vient du produit (`hero_video_url`, `hero_video_poster_path`),
  saisi à la main dans le back-office. C'est la seule vidéo utilisable en fond
  de section, parce que c'est la seule dont nous disposons légalement.

`GameListing.video` vaut `null` quand rien n'est renseigné — la section affiche
alors `heroUrl`. Un fond vidéo doit être `autoplay muted loop playsinline`,
avec `poster` renseigné, et ne se charger qu'une fois la section visible.

## Pannes

L'accueil ne doit jamais afficher d'erreur parce qu'IGDB est indisponible.

| Cas | Comportement |
| --- | --- |
| IGDB non configuré | Le site fonctionne. Le back-office l'affiche sur la fiche produit. |
| IGDB injoignable / délai dépassé (8 s) | Lecture depuis le cache. Recherche : liste vide + motif affiché. |
| Jeton expiré | Renouvelé une fois, automatiquement. |
| Quota atteint (429) | Message explicite, jamais de réessai en boucle. |
| Jeu inexistant | « Jeu introuvable sur IGDB », pas une panne. |
| Fiche périmée + IGDB en panne | La fiche périmée est servie : mieux que rien. |
| Aucune image | Photos du produit, puis aplat. |

## Ce qui reste à faire

La section « Derniers jeux » de l'accueil n'existe pas encore : les composants
`GameCard`, `GameRail` et `FeaturedGame` sont attendus de Claude Design. La
source de données les attend :

```ts
import { getHomepageGames } from "@/lib/shop/games";
const { featured, latest } = await getHomepageGames(12);
```

`GameListing` (voir `lib/shop/games.ts`) porte déjà tout ce dont ces composants
ont besoin — visuels déjà choisis selon leur usage, prix, disponibilité, vidéo —
et ne mentionne jamais IGDB.
