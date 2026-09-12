# Design « 207 MÉDI@ROME » — charte v4

Le site public suit désormais le **handoff v4 de Claude Design**
(`207 MEDI@ROME v4.dc.html`, `README.md` du bundle) : fond sombre et lumineux,
quatre accents, surfaces en verre, formes arrondies et une charte de mouvement
assumée. Elle remplace la charte « papier / encre » anguleuse décrite plus bas,
qui reste **en vigueur dans le back-office**.

## Tokens v4

| Rôle | Valeur |
| --- | --- |
| Fond | `#07060a` |
| Texte / secondaire / tertiaire / faible | `#f4f2ff` · `#b9b4e8` · `#9a95c4` · `#8f8ab8` |
| Lime (accent principal, prix, jauge) | `#d8ff3e` |
| Cyan (sélection) | `#33e1ff` |
| Violet (dégradés, lueurs) | `#7c5cff` |
| Rose (ponctuation) | `#ff5ca8` |
| Verre | `linear-gradient(160deg, rgba(244,242,255,.09), rgba(244,242,255,.02))` + `blur(10px)` |
| Dégradé de bouton | `linear-gradient(120deg, #7c5cff, #33e1ff)` sur texte `#07060a` |

Polices : **Bricolage Grotesque** (titres), **Instrument Sans** (texte),
**DM Mono** (étiquettes, prix, compteurs). Rayons 999 / 14 / 20 / 24-28 / 32 px.
Courbe standard `cubic-bezier(.16, 1, .3, 1)`.

Sur un aplat lime ou cyan, le texte repasse en fond (`--color-on-accent`) :
c'est le seul couple lisible de la charte, et son piège le plus fréquent.

## Mouvement

`components/marketing/motion.tsx` porte les effets qui demandent du script —
halo au curseur, tilt 3D, bouton magnétique, compteurs, anneau de progression,
révélations au défilement. Les autres (nuées dérivantes, scintillement du titre,
reflet balayant, bandeau défilant, point pulsant) sont des animations CSS de
`globals.css`. Tout est coupé par `prefers-reduced-motion`.

**Le piège signalé par le handoff est traité** : la translucidité des
révélations n'est posée que sous `[data-reveal-armed]`, attribut ajouté par le
script lui-même. Sans JavaScript, ou si l'observateur ne répond pas, la page
reste entièrement visible. L'observateur interroge le `document`, se réarme sur
mutation, et révèle immédiatement ce qui est déjà à l'écran.

## Le back-office garde l'ancienne charte

`.theme-ink` est écrit en valeurs littérales : il ne dépend plus d'aucun token
de `:root`. Le back-office reste donc exactement ce qu'il était — sombre,
anguleux, sans ombre — pendant que le site public change de charte. Seules les
polices sont communes.

---

# Design « 207 Mediarom » — intégration du handoff Claude Design

Le handoff (`207 Mediarom.dc.html`, `207 Mediarom Admin.dc.html`, `README.md`) est la
**source de vérité visuelle**. Ce document décrit comment il a été reproduit dans
l'application Next.js existante, ce qui a été volontairement laissé de côté et les
écarts restants.

## Le site ne vend plus rien

Le client a retiré la vente : plus de boutique, plus de panier, plus de tunnel
de commande. Les routes publiques `/boutique`, `/panier`, `/commande-boutique`
et `/compte/commandes` sont supprimées, ainsi que la moitié « Vente » du hero et
la section « En rayon » de l'accueil. Ce qui subsiste :

- le **back-office** garde ses modules Stock et Commandes : ils portent
  l'historique, et `lib/shop/*` reste branché sur le retour de paiement ;
- la **reprise** reste en ligne : l'atelier rachète des consoles, il n'en revend
  pas ;
- les lignes de `ROUTES` liées à la vente sont conservées et commentées comme
  vestiges — elles ne servent plus qu'à construire des URL côté back-office.

Le tableau ci-dessous décrit le site tel qu'il a été construit ; les lignes
« Boutique » n'ont donc plus d'équivalent en ligne.

## Périmètre retenu

Première passe : seul le périmètre « réparation » du projet initial avait été retenu.
La passe de complétude fonctionnelle a ensuite branché **tout** le périmètre de la
maquette sur de vraies données : boutique, panier, commandes de vente, stock, reprises,
photos client, fiches consoles.

| Élément de la maquette | Décision |
| --- | --- |
| Bandeau d'infos, header sticky, logo « 207 / MEDIAROM », footer mono | **Reproduit** (données : réglages `brand` + `social`) |
| Hero deux portes « Vente / Réparation » | **Reproduit** (blocs CMS `homepage.sale` et `homepage.hero`), liens consoles / jeux / accessoires / rétro / suivi / espace client |
| Bandeau de garanties (4 cellules) | **Reproduit** (bloc CMS `homepage.reassurance`) |
| Boutique, filtres, cartes produits, « Panier · N », « Ajouter » | **Reproduit** : produits réels (`products`), panier local chiffré par le serveur, catalogue complet `/boutique` avec recherche / filtres / tri, fiche produit, commande et paiement |
| Section Réparation : explication, liste 01-04, tarifs indicatifs, **fiche de réparation 4 étapes** | **Reproduit** ; tarifs = prestations réelles du catalogue, fiche branchée sur le pricing serveur |
| Zone « déposez photos / vidéo » (étape 3) | **Reproduit** (photos ; bucket privé `customer-media`, rattachées au dossier) |
| Reprise & rétro | **Reproduit** (blocs CMS `homepage.tradein` / `homepage.retro`, formulaire `/reprise`, rayon rétro de la boutique) |
| Le magasin (adresse, horaires, photo) | **Reproduit** (réglages `brand`, première photo de la galerie ou placeholder rayé) |
| Back-office : header, onglets, bandeau KPI, maître/détail Réparations | **Reproduit** avec les vrais dossiers, permissions et audit existants. Allégé ensuite : cinq entrées de premier niveau (Réparations, Commandes, Stock, Clients, Plus), le reste regroupé dans un menu « Plus » par usage (Gestion, Atelier, Configuration, Administration) ; quatre indicateurs sur le tableau de bord (en atelier, devis à valider, prêts à expédier, SAV ouverts), les statistiques financières étant dans Statistiques ; listes de dossiers en filets plutôt qu'en cartes encadrées |
| Onglets Commandes / Stock / Reprises | **Reproduits** (`/admin/shop-orders`, `/admin/stock`, `/admin/trade-ins`) avec les vraies tables ; les modules existants (Dossiers, Réception, SAV, Clients, Catalogue, Options, Packs, Transport, Techniciens, Contenu, Avis, Analytics, Réglages, Audit) sont des onglets du même style |

## Design system

- Tokens dans `app/globals.css` : deux ambiances partageant les mêmes variables
  (`:root` papier pour le site et l'espace client, `.theme-ink` encre pour le back-office).
- Polices : Archivo (400/500/600/800) et IBM Plex Mono (400/500/600) via `next/font/google`
  (`app/layout.tsx`), repli Helvetica / monospace.
- **Aucun arrondi, aucune ombre** : les espaces de noms `--radius-*` et `--shadow-*` de
  Tailwind sont neutralisés et une règle globale force `border-radius: 0`.
- Primitives réécrites : `components/ui/{button,badge,card,form,misc,stepper,timeline,alert}.tsx`
  et `components/admin/ui.tsx` (KPI, tableaux, onglets, filtres).
- Badges de statut : ambre / bleu / vert / neutre / danger, mono 10,5 px majuscules.

## Correspondance pages

| Maquette | Route | Composants |
| --- | --- | --- |
| Site public (une page) | `/` | `app/(marketing)/page.tsx`, `components/marketing/sections.tsx`, `components/repair/repair-form.tsx` |
| Fiche de réparation | `/reparation`, `/reparation/[modèle]`, `/commande/[prestation]` | `RepairForm` (étape initiale et présélections selon la page) |
| Fiche prestation (SEO) | `/reparation/[modèle]/[panne]` | en-tête encre + carte prix papier |
| Confirmation | `/commande/confirmation/[id]` | récapitulatif encre, étapes 01-04 |
| Admin Réparations | `/admin` | `app/admin/page.tsx` (liste + filtres + fiche : panne décrite, photos, avancement cliquable, devis, note d'atelier, actions, historique) |
| Fiche dossier complète | `/admin/orders/[id]` | onglets Réception / Diagnostic / Devis / Réparation / Tests / Expédition / Médias / Historique |
| Boutique | `/boutique`, `/boutique/[produit]`, `/panier`, `/commande-boutique`, `/commande-boutique/confirmation/[id]` | `components/shop/*` |
| Reprise | `/reprise`, `/reprise/confirmation/[id]`, `/reprise/suivi/[jeton]` | `components/tradein/*`, `components/customer/draft-photo-uploader.tsx` |
| Fiches consoles | `/consoles`, `/consoles/[modèle]` | `app/(marketing)/consoles/*` |
| Admin Commandes / Stock / Reprises | `/admin/shop-orders`, `/admin/stock`, `/admin/trade-ins` (+ `/admin/clients` → clients) | `components/admin/shop-forms.tsx` |

## Comportement de la fiche de réparation

1. **Quel appareil ?** — plateforme (marques actives + regroupement « Rétro ») puis
   modèle exact (précision = variantes ou année) ; les prestations de l'étape 2 sont
   celles liées en base à ce modèle.
2. **Quelle prestation ?** — prestations publiées du modèle (choix unique) puis options
   et packs **compatibles** (choix multiples), calculés côté serveur. Les prestations
   sont regroupées par catégorie (`repair_categories`) : chaque catégorie est un bloc
   dépliable portant son nombre de pannes, la première est ouverte par défaut, et un
   champ de recherche apparaît au-delà de quatorze prestations. Une prestation dont le
   tarif n'est pas encore arbitré (`price_is_provisional`) annonce « sur devis » — et
   « sur devis après diagnostic » dans le récapitulatif — au lieu d'un prix.
3. **Décrivez le problème** — description libre (≥ 20 caractères ou au moins un
   symptôme), symptômes à choix multiples (pannes fréquentes du modèle + génériques,
   stockés dans `repair_orders.symptoms`), dépôt de photos (jusqu'à 6), n° de série.
4. **Envoi et coordonnées** — coordonnées, adresse de retour, formules de transport
   réelles, récapitulatif (prix et TVA vérifiés par le serveur), conditions, CGV.
   « Envoyer ma demande » crée le dossier puis redirige vers le paiement.

## Responsive

Le handoff mobile (écrans M1 à M6) est intégré et documenté à part :
**[MOBILE.md](./MOBILE.md)** — points de rupture, écran par écran, utilitaires
partagés et écarts assumés. Le rendu de bureau décrit ici est inchangé : toutes
les classes mobiles sont écrites en `max-sm` / `sm:` / `lg:`.

## Écarts assumés

- Sur mobile, la navigation principale passe derrière un burger de 38 px qui ouvre
  un panneau plein écran, et une barre d'onglets basse (Accueil, Boutique, Réparer,
  Compte) double les quatre destinations principales — voir MOBILE.md.
- L'étape 2 combine une prestation principale (radio) et des options (cases) : le
  backend facture une prestation par dossier, les prestations supplémentaires passent
  par un devis complémentaire.
- Les textes « diagnostic sous 48 h », « retour sous 5 jours », « garantie 3 mois » du
  prototype n'ont pas été repris : les délais et garanties affichés sont ceux du
  catalogue et des réglages.
- La photo de la façade du magasin est réelle, fournie par le client : elle est livrée
  avec le site (`public/medias/facade-207-mediarom.webp`) et référencée dans
  `gallery_items` sous la catégorie `storefront`, servie par `publicMediaUrl` qui laisse
  passer les chemins commençant par « / ». Le bloc « Le magasin » de l'accueil la
  privilégie ; le gérant peut la remplacer depuis Contenu → Galerie.
- Les autres photos (vitrine, produits, consoles) sont des aperçus rayés tant qu'aucune
  photo n'est publiée depuis le back-office. La fiche console affiche la photo du modèle
  (`console_models.image_path`, téléversée dans Catalogue → Modèles) avec le nom complet
  du modèle en texte alternatif ; sans photo, l'aperçu annonce explicitement ce qui
  manque plutôt que d'afficher une illustration qui ne serait pas la console.
