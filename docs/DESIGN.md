# Design « 207 MÉDI@ROME » — direction actuelle

Le site public suit le handoff **« Direction visuelle 207 MÉDI@ROME »**
(`MIDIAROM Direction visuelle.dc.html` + son README). Blanc, noir, gris, un
seul rouge. Elle remplace la charte v4 sombre — fond `#07060a`, quatre accents,
surfaces en verre, formes arrondies — qui n'existe plus nulle part sur le site
public. **Le back-office n'a pas été repris** et garde son apparence propre.

Le nom s'écrit toujours **207 MÉDI@ROME**, en capitales. Il vient des réglages
(`site_settings.brand`) : rien ne l'écrit en dur, seule la mise en capitales est
une affaire d'affichage.

## Tokens

| Rôle | Valeur |
| --- | --- |
| Fond | `#ffffff` |
| Fond sourd (encadrés) · plaque d'attente | `#fafafa` · `#f4f4f6` |
| Encre | `#0f0f11` |
| Texte secondaire · tertiaire | `#4a4a51` · `#6e6e73` |
| **Rouge d'accent** | `#d81f26` |
| Rouge sur fond noir | `#ff5a60` |
| Filets : interne · carte · section · fort | `#ededf0` · `#e0e0e4` · `#e6e6e9` · `#dcdce0` |
| Sur fond noir : texte · secondaire · labels | `#f2f2f4` · `#b9b9c0` · `#7e7e86` |

Contrastes mesurés sur blanc : encre 18,4:1 · `#4a4a51` 8,3:1 · `#6e6e73` 5,07:1
· rouge 5,07:1. Tout passe AA. **Ne pas éclaircir ces gris** : `#8b8b93` tombe à
3,4:1 et n'est admis qu'en décor (`--text-4`).

**Le rouge ne sert qu'à six choses** : le carré du logo, les intitulés de
section, le CTA principal, le soulignement de l'onglet actif, l'affordance au
survol (flèche d'une ligne de panne, bouton d'une carte produit) et les puces de
la liste savoir-faire. Nulle part ailleurs. Aucun néon, aucun dégradé, aucun
violet ni cyan.

Polices : **Archivo** 400/500/600/700 (titres et corps), **IBM Plex Mono**
400/500 (étiquettes, prix, références, badges, HUD). Le mono ne porte jamais un
paragraphe : il marque ce qui se lit d'un coup d'œil.

**Angles nets.** Rayon 0 partout, sauf les boutons du header, les deux CTA du
hero (`8–9px`) et le champ de recherche (`8px`). Les primitives partagées
(`components/ui/*`) sont à `2px`. Aucune ombre au repos ; une seule, au survol
d'une carte : `0 14px 30px rgba(15,15,17,0.1)`.

## Mouvement

Une courbe, `cubic-bezier(.2,.8,.25,1)`, et quatre effets — tout en CSS, aucune
bibliothèque :

| Effet | Où |
| --- | --- |
| `riseIn` | arrivée d'un bloc, au chargement (`data-enter="1..4"`, décalé de 60 ms) et au défilement (`data-rise`, `animation-timeline: view()`) |
| survol de carte | `data-card` : `translateY(-3px)`, bordure encre, ombre, photo `data-zoom` à 1.05, bouton `data-buy` au rouge |
| survol de ligne | `data-row` : fond `#fafafa`, `padding-left: 10px`, flèche `data-arrow` décalée et rouge |
| identité gaming | `data-scan` (balayage de diagnostic), `data-pad` (croix directionnelle), `data-hud-dot` (témoin qui clignote) — **uniquement dans le cadre du visuel du hero**, jamais sur un titre ni un CTA. Les deux premiers disparaissent sous 700px |

`prefers-reduced-motion: reduce` coupe tout et laisse la page entièrement
visible. Deux pièges traités :

- `[data-rise]` ne pose sa translucidité que sous `@supports (animation-timeline: view())` :
  un navigateur qui ne connaît pas `view()` affiche le bloc tel quel, au lieu de
  le laisser invisible en attendant un observateur qui n'existe pas.
- **Un ancêtre en `overflow: hidden` devient un conteneur de défilement** :
  `view()` s'y accroche et la révélation se fige à mi-course. On clippe la
  photo, jamais la section.

## Grilles

Conteneur `max-width: 1380px`, gouttière latérale 22px. Toutes les grilles sont
en `auto-fit` / `auto-fill` + `minmax` — hero 320px, plateformes 290px, parcours
224px, savoir-faire 300px, rayons 268px, produits 232px.

**Une exception : la bande de confiance.** Ses pistes sont **fixées** — 4, puis
2 sous 1000px, puis 1 sous 520px — et aucune cellule ne porte de bordure : c'est
la gouttière d'1 px sur fond gris qui dessine les filets. C'est ce qui empêche
un trait de pendre dans le vide quand la rangée se replie.

Vérifié sans débordement horizontal à **390, 760, 924, 1100 et 1380 px**
(mesure `document.scrollWidth` contre `clientWidth`, via le protocole de
débogage de Chrome).

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
| Reprise | `/reprise`, `/reprise/confirmation/[id]`, `/reprise/suivi/[jeton]` | `components/tradein/*`, `components/customer/draft-photo-uploader.tsx` |
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

## L'en-tête et ses volets

Une seule ligne au-dessus de 1280 px : logo, six rayons, recherche, les trois
utilitaires en mono, le bouton rouge. Les entrées de rayon viennent de
`product_categories` — un rayon ouvert au back-office est dans le menu sans
redéploiement — et portent un libellé court : « Figurines », pas « Figurines
Manga / Anime », parce que six entrées doivent tenir sur une ligne de 1440 px.

**Au survol, un rayon montre ce qu'il contient.** « Consoles » déplie les
consoles en vente, « Jeux vidéo » leurs plateformes, « Figurines » leurs
licences, puis un « Voir plus » vers le rayon entier. Trois règles le
gouvernent :

- **Ce qu'il montre vient du catalogue**, jamais d'une liste écrite en dur :
  c'est `products.platform`, comptée par rayon (`getProductTags`). Une console
  mise en vente le matin est dans le menu l'après-midi, et une valeur qui
  disparaît du stock disparaît du menu.
- **C'est le rayon qui nomme la colonne.** L'intitulé du volet est
  `tagLabel` au pluriel : « plateformes » dans les jeux et les consoles,
  « licences » dans les figurines. La même colonne, pas le même mot — c'est ce
  qui évitait déjà à « Naruto Shippuden » de se lire comme une console dans le
  filtre de la boutique.
- **Huit entrées au plus**, les mieux fournies d'abord, puis le lien vers le
  rayon. Un menu qui déroule quarante licences ne raccourcit plus rien : il
  refait la page qu'il est censé remplacer. Un rayon vide n'ouvre pas de volet.
- **Le lien du bas dit « Voir plus », partout.** Il a d'abord porté le compte
  du rayon — « Voir les 9 consoles » — ce qui était juste et se mettait à jour
  tout seul, mais n'apprend plus rien passé quelques dizaines de références :
  « Voir les 312 jeux vidéo » ne se lit pas, il se subit. Le volet montre déjà
  ce qui compte ; ce lien dit seulement qu'il y a la suite. L'en-tête n'a donc
  plus besoin des compteurs de rayon — une requête de moins sur chaque page.

Le volet s'ouvre au survol **et au clavier** — la tabulation sur un rayon le
déplie et entre dans ses liens ; Échap referme et rend le focus au rayon. La
fermeture au départ de la souris attend 120 ms : une trajectoire en diagonale
vers le menu sort brièvement de l'entrée, et un volet qui se referme sous le
curseur est inutilisable. L'entrée reste un lien vers le rayon : le volet
abrège le chemin, il ne le remplace pas, et un appareil tactile — qui n'a pas
de survol — navigue.

Le tiroir du téléphone ne porte pas les volets : un téléphone n'a pas de
survol, et déplier trois sous-listes ferait du tiroir une page à défilement là
où il tient aujourd'hui d'un coup d'œil. Les filtres de la boutique y donnent
accès.

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
