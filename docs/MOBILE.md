# Responsive « 207 Médi@roM » — intégration du handoff mobile

Complément à [DESIGN.md](./DESIGN.md). Le handoff mobile de Claude Design
(`MOBILE.md` + `207 Mediarom Mobile.dc.html`, écrans M1 à M6) est la **source de
vérité visuelle** ; ce document décrit comment il a été reproduit, ce qui a été
volontairement laissé de côté et pourquoi.

Un seul site responsive : pas de version mobile séparée, pas de redirection `m.`.

## Points de rupture

| | Largeur | Mise en page |
| --- | --- | --- |
| Téléphone | `< 640px` (`max-sm`) | une colonne, barre d'onglets basse, menu plein écran |
| Tablette | `640–1023px` (`sm`) | header sans nav, grilles à deux colonnes |
| Bureau | `≥ 1024px` (`lg`) | la mise en page de DESIGN.md, inchangée |

Toutes les classes mobiles sont écrites **mobile-first** avec leur pendant `sm:`
ou `lg:` : le rendu de bureau du handoff n'a pas bougé d'un pixel.

## Règles non négociables et où elles sont tenues

| Règle | Où |
| --- | --- |
| `meta name="viewport"` | `app/layout.tsx` (`export const viewport`) |
| Aucun débordement horizontal | vérifié à 360 / 390 / 430 px sur les 14 routes publiques et sur `/admin`, `/admin/shop-orders`, `/admin/stock` |
| Cibles tactiles ≥ 44 px | `.chip` (`min-height: 44px`), `Button` taille `sm`, pastilles de symptômes, `FilterChips`, résumés de FAQ, burger |
| Champs ≥ 16 px | `components/ui/form.tsx` (`inputBase`), fiche de réparation, formulaire de reprise, recherche du back-office |
| Corps de texte ≥ 15 px | aucune taille n'a été réduite pour faire tenir une mise en page |
| `env(safe-area-inset-bottom)` | utilitaire `.safe-bottom` (barre d'onglets, barre d'action de la fiche) |
| Aucun arrondi, aucune ombre, aucune animation | inchangé — la règle globale de `globals.css` reste la seule autorité |

## Quatre utilitaires, dans `app/globals.css`

Tous dans `@layer components`, pour que les utilitaires Tailwind du site d'appel
gardent la main.

- `.chip` — pastille mono du handoff : 44 px de haut au doigt, 9 px de padding à
  la souris.
- `.scroll-strip` — bande à défilement horizontal (barre de défilement masquée)
  plutôt que des colonnes écrasées.
- `.safe-bottom` — ajoute la marge de l'iPhone à encoche au padding voulu, passé
  en `--safe-pb`.
- `.screen-dvh` — hauteur d'écran réelle (`100dvh`), qui suit la rétraction de la
  barre d'URL de Safari.
- `.table-cards` — tableau du back-office converti en cartes empilées ; chaque
  `Td` porte alors un `label` qui remplace l'en-tête masqué.

## Écran par écran

### M1 — Accueil

- Bandeau d'infos réduit à une ligne (`207 rue de Rome · Marseille · depuis 1997`) ;
  téléphone et horaires restent dans la section magasin, le pied de page et le menu.
- Header sur une seule ligne : logo réduit et burger 38 × 38 dans une zone
  cliquable de 44 px. (Le lien « Panier · N » a disparu avec la boutique.)
- Menu **plein écran** sur fond papier, liens 24 px / 600, fermeture par « × »,
  puis suivi de réparation, connexion, adresse et horaires. Apparition immédiate.
- Hero : le bloc « vente / réparation » du handoff est devenu un bloc unique
  consacré à l'atelier, titre 34 px, deux boutons pleine largeur.
- Bandeau de garanties en bande à défilement horizontal.
- Section magasin : « Appeler le magasin » puis « Itinéraire » en pleine largeur.
- **Barre d'onglets basse** (`components/marketing/tab-bar.tsx`) : Accueil,
  Réparer, Suivi, Compte. Icônes Lucide linéaires 1,5 px, l'active en orange.
  Un talon de 64 px l'empêche de recouvrir le pied de page.

### M2 — Boutique (supprimée)

Le site ne vend plus rien : la boutique, le panier et le tunnel de commande ont
été retirés. La grille produits à deux colonnes et la carte compacte décrites
par le handoff mobile n'ont plus de page où s'afficher. Le conteneur du site
garde en revanche sa gouttière de 16 px au téléphone, posée à cette occasion.

### M3 / M4 — Fiche de réparation

Le parcours le plus important du site. Sous 640 px, il ne ressemble plus au
bureau : **cinq écrans, une question par écran**. Le bureau en garde quatre et
n'a pas changé d'un pixel — c'est le même état, le même modèle de données, les
mêmes actions serveur. Le code vit dans `components/repair/repair-form.tsx`,
derrière un unique `if (phone)` (`useMobile(MQ_TELEPHONE)`), avant le rendu de
bureau resté intact.

Les cinq écrans : **la console**, **le modèle**, **l'intervention**, **la
panne**, **l'envoi**. L'étape 1 du bureau se lit en deux écrans — d'où cinq
écrans pour quatre étapes ; `phase` (`marque` / `modele`) porte cette coupure.

- **La fiche est la page.** `/reparation` perd sous 640 px son bandeau sombre,
  son titre, son paragraphe d'introduction et les quatre étapes de « comment ça
  marche » : la progression en haut de la fiche raconte déjà la même chose. La
  grille « toutes les consoles » descend derrière le lien « Voir les N consoles
  prises en charge » (une bascule `:target`, sans JavaScript), au lieu de poser
  au bas de la page un second sélecteur de console.
- **Bandeau de progression**, en encre : retour de 38 px, `Étape N sur 5 · <nom
  de l'écran>` en mono 10 px, un filet rouge de 2 px, et « Aide ». Il remplace
  l'anneau, le titre d'étape en 33 px et le bloc « Estimation » — trois objets
  pour dire une chose. Le chiffre, lui, vit sur le bouton, là où le pouce est
  déjà.
- **Fil des choix** : la console puis l'intervention restent affichées en
  pastilles cliquables sous le bandeau. Le contexte est permanent au lieu d'être
  réaffirmé par un récapitulatif à chaque écran.
- **Barre d'action collée en bas** : `sticky`, pas `fixed` — le clavier tactile
  la pousse au lieu de la recouvrir. Son libellé dit ce qui manque
  (« Choisissez votre console », « Décrivez la panne ») plutôt que « Continuer »
  sur un bouton éteint.
- Écrans 1 et 2 : des **lignes** de 60 px, pas des cartes — nom en 19 px, repère
  en mono, chevron à droite.
- Écran 3 : recherche, puis **une seule liste à plat** (les familles
  d'intervention ne faisaient qu'ajouter des paliers), case **carrée** de 20 px,
  prix à droite ; les options passent sous un filet, en « À ajouter ».
- Écran 4 : zone de texte de 118 px, compteur honnête (« Encore N caractères, ou
  cochez un symptôme » — la règle de validation, mot pour mot), pastilles de
  symptôme de 44 px, **bouton d'appareil photo** (`capture="environment"`),
  numéro de série et « déjà ouverte ».
- Écran 5 : un champ par ligne, étiquettes permanentes, et le **récapitulatif en
  dernier**, juste avant le bouton, avec l'estimation en 20 px.

Deux points de mise en œuvre qui se sont payés cher :

- **La remontée d'écran déduit la hauteur de l'en-tête collant du site**
  (`[data-entete-site]`, mesurée et non écrite en dur). Remonter sur le haut de
  la fiche posait le bandeau d'étape et la question *sous* l'en-tête, haut de
  deux lignes au téléphone : l'écran s'ouvrait sur sa troisième ligne.
- **Elle ne se déclenche pas au montage.** Sur `/reparation/<modèle>`, la fiche
  n'ouvre pas la page : la console, sa photo et la liste de ses interventions la
  précèdent, et remonter dessus à l'arrivée escamotait ce que le visiteur venu
  de la recherche était précisément venu lire.

La barre d'onglets basse s'efface sur les écrans dont la fiche est le contenu
(`/reparation`, `/reparation/<modèle>`, `/commande/<id>`) : le design de référence
ne la montre que sur l'accueil, et deux barres superposées mangeraient 120 px.
Sur l'accueil, où la fiche n'est qu'une section, `stickyActions={false}` rend la
barre d'action au flux de la page.

### M5 / M6 — Back-office

- Bandeau KPI en bande à défilement horizontal (cellules 132 px, note retirée).
- Onglets et filtres de statut à défilement horizontal.
- Tableaux **Commandes** et **Stock** convertis en cartes empilées via
  `<Table cards>` + `<Td label="…">`.
- Maître/détail en **navigation à deux niveaux** : sans `?sel=`, la liste seule ;
  avec, la fiche seule et un retour « ← Liste des dossiers ». Sur grand écran,
  les deux colonnes restent côte à côte et la première ligne est présélectionnée.
- « Avancement » en bande à défilement : huit segments à se partager 360 px
  donneraient huit libellés tronqués à trois lettres.

## Écarts assumés

- **Libellés courts du bandeau de garanties** : les textes viennent du bloc CMS
  `homepage.reassurance`. Les raccourcir automatiquement reviendrait à réécrire du
  contenu client ; la bande défile, les libellés restent entiers.
- **Liens du pied de page** : ils passent à la ligne au lieu de former une colonne
  stricte — le pied compte treize liens plus les réseaux, une colonne en ferait
  une page à elle seule.
- **Segment actif amené dans la vue** (M6) : la bande d'avancement défile à la
  main ; le recentrage automatique demanderait du JavaScript pour un gain faible.
- **Vidéo dans le dépôt de fichiers** : la zone reste en photos seules, comme le
  reste de l'application (le bucket `customer-media` n'accepte pas la vidéo).

## Vérification

`scripts` de contrôle utilisés (Playwright, hors dépôt) : chargement des 14 routes
publiques et des 3 routes de back-office à 360, 390 et 430 px (la boutique et le panier ont depuis été retirés), mesure de
`scrollWidth - clientWidth`, de la hauteur de chaque commande et de la taille de
police de chaque champ. Résultat attendu et obtenu : **aucun débordement, aucune
cible sous 44 px, aucun champ sous 16 px**, à chacune des trois largeurs.

La trame en cinq écrans a été parcourue de bout en bout à 390 px sur une
**construction de production** (`npm run build` puis `next start`) : écrans 1 → 5,
progression 20 → 100 %, libellé du bouton juste à chaque étape, bandeau d'étape
entièrement visible sous l'en-tête (`masque = 0`), `scrollWidth - clientWidth = 0`
partout, aucune exception JavaScript.

**Piège de mesure.** En émulation CDP, `window.innerWidth` reste périmé après une
navigation — il rend la largeur de l'appareil **plus la barre de défilement**
(390 + 16) tant qu'aucun recalcul n'a eu lieu, et le fond `fixed inset-0` s'étire
d'autant. On lit alors un débordement de 16 px qui n'existe pas : `body.scrollWidth`
vaut 390, rien ne dépasse, et la page ne défile pas latéralement. Réappliquer
`Emulation.setDeviceMetricsOverride` avant de mesurer lève l'artefact.

Ce qui ne se vérifie pas en émulation, et reste un choix assumé : que le clavier
tactile **pousse** la barre d'action au lieu de la recouvrir. C'est ce que
garantit `sticky` plutôt que `fixed`.

Les captures sont refaites après chaque changement : le rendu de bureau est
contrôlé à 1280 px dans la foulée, pour vérifier qu'aucune classe `sm:` n'a été
oubliée.
