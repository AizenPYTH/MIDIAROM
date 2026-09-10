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
| Tablette | `640–1023px` (`sm`) | deux colonnes de produits, header sans nav |
| Bureau | `≥ 1024px` (`lg`) | la mise en page de DESIGN.md, inchangée |

Toutes les classes mobiles sont écrites **mobile-first** avec leur pendant `sm:`
ou `lg:` : le rendu de bureau du handoff n'a pas bougé d'un pixel.

## Règles non négociables et où elles sont tenues

| Règle | Où |
| --- | --- |
| `meta name="viewport"` | `app/layout.tsx` (`export const viewport`) |
| Aucun débordement horizontal | vérifié à 360 / 390 / 430 px sur les 14 routes publiques et sur `/admin`, `/admin/shop-orders`, `/admin/stock` |
| Cibles tactiles ≥ 44 px | `.chip` (`min-height: 44px`), `Button` taille `sm`, `AddToCartButton`, pastilles de symptômes, `FilterChips`, résumés de FAQ, burger |
| Champs ≥ 16 px | `components/ui/form.tsx` (`inputBase`), fiche de réparation, formulaire de reprise, recherche boutique et back-office |
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
- Header sur une seule ligne : logo réduit, « Panier · N », burger 38 × 38 dans une
  zone cliquable de 44 px.
- Menu **plein écran** sur fond papier, liens 24 px / 600, fermeture par « × »,
  puis suivi de réparation, connexion, adresse et horaires. Apparition immédiate.
- Hero empilé, vente d'abord, titre 34 px, **un seul bouton par moitié** — les
  boutons secondaires vivent déjà dans les sections Reprise et Réparation.
- Bandeau de garanties en bande à défilement horizontal.
- Section magasin : « Appeler le magasin » puis « Itinéraire » en pleine largeur.
- **Barre d'onglets basse** (`components/marketing/tab-bar.tsx`) : Accueil,
  Boutique, Réparer, Compte. Icônes Lucide linéaires 1,5 px, l'active en orange.
  Un talon de 64 px l'empêche de recouvrir le pied de page.

### M2 — Boutique

Grille produits à **2 colonnes**, carte resserrée (padding 12 px, badge 9,5 px,
nom 14 px, prix 15 px) et bouton « Ajouter » **en pleine largeur sous le prix** :
côte à côte dans 160 px, prix et bouton se chevauchaient. Chips de catégorie en
bande à défilement, contrôles de filtre en pleine largeur.

Le conteneur du site (`components/ui/misc.tsx`) passe à 16 px de gouttière au
téléphone : les 8 px gagnés de chaque côté font la différence entre deux colonnes
et une.

### M3 / M4 — Fiche de réparation

Le parcours le plus important du site.

- **Étapes 1-2 sur fond encre**, 3-4 sur papier — la carte se fond dans la section
  sombre qui l'accueille, puis repasse sur papier pour la saisie de texte.
  Attention au piège signalé par le handoff : une ligne sélectionnée garde son fond
  clair `--selection`, son texte doit donc repasser en encre foncée.
- **Barre d'action collée en bas** : `sticky`, pas `fixed` — le clavier tactile la
  pousse au lieu de la recouvrir. Elle porte la barre de progression et **le total
  en cours** (« Continuer · 128 € ») ; rien n'est affiché tant que la prestation
  est « sur devis », ce qui est le cas de tout le catalogue actuel.
- Étape 1 en 2 colonnes, boutons de 60 px de haut minimum.
- Étape 2 en pleine largeur, case 18 × 18 alignée en haut, prix sur la ligne du
  libellé, note en dessous.
- Étape 3 : zone de texte non redimensionnable, **bouton d'appareil photo**
  (`capture="environment"`) à côté de la zone de dépôt, et **récapitulatif compact**
  (appareil, prestation, estimation) que le bureau n'affiche qu'à l'étape 4.
- Étape 4 : un champ par ligne.

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

- **Feuille de filtres de la boutique** : les filtres s'empilent en pleine largeur
  au lieu de s'ouvrir dans une feuille plein écran. Rien n'est caché, et la
  boutique est vide tant que le stock réel n'est pas saisi — le formulaire ne
  s'affiche même pas.
- **Libellés courts du bandeau de garanties** : les textes viennent du bloc CMS
  `homepage.reassurance`. Les raccourcir automatiquement reviendrait à réécrire du
  contenu client ; la bande défile, les libellés restent entiers.
- **En-tête contextuel de la fiche de réparation** : le header du site reste en
  place au lieu d'être remplacé par « ← Fiche de réparation · Étape N / 4 ». La
  barre de progression a été reportée sur la barre d'action basse, où elle reste
  visible pendant tout le défilement de l'étape.
- **Liens du pied de page** : ils passent à la ligne au lieu de former une colonne
  stricte — le pied compte treize liens plus les réseaux, une colonne en ferait
  une page à elle seule.
- **Segment actif amené dans la vue** (M6) : la bande d'avancement défile à la
  main ; le recentrage automatique demanderait du JavaScript pour un gain faible.
- **Vidéo dans le dépôt de fichiers** : la zone reste en photos seules, comme le
  reste de l'application (le bucket `customer-media` n'accepte pas la vidéo).

## Vérification

`scripts` de contrôle utilisés (Playwright, hors dépôt) : chargement des 14 routes
publiques et des 3 routes de back-office à 360, 390 et 430 px, mesure de
`scrollWidth - clientWidth`, de la hauteur de chaque commande et de la taille de
police de chaque champ. Résultat attendu et obtenu : **aucun débordement, aucune
cible sous 44 px, aucun champ sous 16 px**, à chacune des trois largeurs.

Les captures sont refaites après chaque changement : le rendu de bureau est
contrôlé à 1280 px dans la foulée, pour vérifier qu'aucune classe `sm:` n'a été
oubliée.
