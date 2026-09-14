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

Tester la connexion, depuis un poste qui a les identifiants :

```bash
npm run check:igdb                # authentification seule
npm run check:igdb -- "zelda"     # + une vraie recherche
```

Le script diagnostique les refus au lieu de planter. Un **HTTP 403 ou 400**
signifie presque toujours que le *Client Type* de l'application Twitch est
« Public » : il doit être « Confidential », sinon le secret délivré n'est pas
valable pour le flux client credentials.

### Vérifier le câblage sans identifiants

Le test `tests/env-igdb.test.ts` verrouille la lecture de `process.env` au
runtime. Pour la vérifier de bout en bout sur une machine sans identifiants, il
suffit de démarrer le serveur avec des valeurs quelconques : l'avertissement
« IGDB n'est pas configuré » du back-office disparaît au profit du champ de
recherche, sans reconstruire le projet. C'est la preuve que la variable est lue
au démarrage du processus, et non figée à la compilation.

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
| `scripts/lib/igdb-cli.mjs` | **Socle des scripts** : jeton Twitch, requête, champs. Une seule définition. |
| `scripts/check-igdb.mjs` | Vérifie la connexion, n'écrit rien |
| `scripts/demo-games.mjs` | Remplit la vitrine de démonstration de l'accueil |

Aucun composant d'affichage n'importe quoi que ce soit de `lib/igdb/` :
ils reçoivent un `GameListing` et ignorent d'où il vient.

### Les scripts envoient la même requête que l'application

`check:igdb` et `demo:games` partagent `scripts/lib/igdb-cli.mjs` : même
authentification, même URL, mêmes champs, **même clause `where`**. La
normalisation, elle, n'est pas recopiée du tout — `demo-games.mjs` importe
directement `lib/igdb/normalize.ts` (Node efface les imports de types, l'alias
`@/` n'est donc jamais résolu à l'exécution ; il faut Node 22.18 ou plus
récent).

Ce n'est pas de la coquetterie. Les deux scripts portaient chacun leur copie de
la requête, et elles ont divergé : `demo-games.mjs` avait gagné un filtre
`& category = 0`. IGDB n'alimente plus ce champ — il a été remplacé par
`game_type` —, la requête répondait donc **HTTP 200 avec une liste vide**, et
les 28 titres ressortaient « introuvables » sans la moindre erreur. Un filtre
mort ne se voit pas : `tests/igdb-cli.test.ts` tient désormais la requête des
scripts alignée sur celle de `lib/igdb/client.ts`.

**Règle** : on ne filtre que `where version_parent = null`, qui écarte les
rééditions parasites. Tout autre tri se fait côté client, sur les résultats
reçus — nom exact d'abord, puis nombre de votes. Ajouter un filtre dans la
requête, c'est risquer de vider silencieusement le résultat.

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

## Quota et catalogue important

IGDB autorise **4 requêtes par seconde** pour toute l'application. Une file
d'attente dans `lib/igdb/client.ts` sérialise et espace les appels : une
recherche isolée n'attend rien, une synchronisation de masse ne part jamais en
rafale. La cadence vaut par processus ; sur plusieurs instances elle se
multiplie, ce qui reste acceptable pour l'usage visé (back-office et tâche
nocturne), et un refus 429 est de toute façon traité proprement.

Le travail nocturne (`/api/cron/daily`, protégé par `CRON_SECRET`) fait deux
choses quand IGDB est configuré — et ne fait rien du tout sinon :

| Fonction | Rôle | Borne |
| --- | --- | --- |
| `refreshStaleGames()` | Rafraîchit les fiches de plus de 30 jours | 50 / nuit |
| `matchUnlinkedGames()` | Associe les produits « Jeu » sans fiche | 25 / nuit |

`matchUnlinkedGames` n'associe **que** les correspondances au-dessus du seuil,
et ne touche jamais à un produit déjà associé : une validation humaine ne doit
pas être défaite par une passe automatique. Les cas douteux restent dans le
back-office, ce qui est le but du score. Si IGDB tombe en cours de route, la
passe s'arrête et reprend la nuit suivante — une fiche périmée reste
parfaitement affichable entre-temps.

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

## Diagnostiquer une recherche qui ne rend rien

Dans l'ordre, du moins cher au plus cher :

```bash
npm run check:igdb                     # les identifiants sont-ils lus ?
npm run check:igdb -- "zelda"          # la recherche aboutit-elle ?
npm run check:igdb -- "zelda" --debug  # quelle requête part exactement ?
npm run demo:games -- --debug          # idem, titre par titre
npm run demo:games -- --dry-run        # résout tout sans rien écrire
```

Les scripts distinguent maintenant trois échecs qui se ressemblaient :

| Message | Ce que ça veut dire |
| --- | --- |
| `aucun résultat IGDB` | IGDB a répondu 200 avec une liste vide — regardez la clause `where` |
| `HTTP 4xx` + `réponse d'IGDB : …` | Requête refusée ; IGDB nomme le champ ou la syntaxe en cause |
| `sans jaquette, écarté` | Jeu trouvé, mais inutilisable pour une vitrine |

Un refus 401 ou 403 arrête le script tout de suite : inutile de répéter la même
panne 27 fois.

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
