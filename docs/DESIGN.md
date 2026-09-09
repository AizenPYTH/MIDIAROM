# Design « 207 Mediarom » — intégration du handoff Claude Design

Le handoff (`207 Mediarom.dc.html`, `207 Mediarom Admin.dc.html`, `README.md`) est la
**source de vérité visuelle**. Ce document décrit comment il a été reproduit dans
l'application Next.js existante, ce qui a été volontairement laissé de côté et les
écarts restants.

## Périmètre retenu

Règle appliquée : ce qui est dans la maquette mais **absent du projet initial** n'a pas
été inventé. La plateforme est un atelier de réparation à distance ; elle n'a ni
boutique, ni stock, ni commandes de vente, ni reprises.

| Élément de la maquette | Décision |
| --- | --- |
| Bandeau d'infos, header sticky, logo « 207 / MEDIAROM », footer mono | **Reproduit** (données : réglages `brand` + `social`) |
| Hero deux portes « Vente / Réparation » | **Adapté** : deux portes « Réparation / Suivi » (fonctions existantes) |
| Bandeau de garanties (4 cellules) | **Reproduit** (bloc CMS `homepage.reassurance`) |
| Boutique, filtres, cartes produits, « Panier · 0 », « Ajouter » | **Retiré** (pas de vente dans le projet) |
| Section Réparation : explication, liste 01-04, tarifs indicatifs, **fiche de réparation 4 étapes** | **Reproduit** ; tarifs = prestations réelles du catalogue, fiche branchée sur le pricing serveur |
| Zone « déposez photos / vidéo » (étape 3) | **Retiré** (pas de dépôt de photos par le client à la demande dans le projet) |
| Reprise & rétro | **Retiré** |
| Le magasin (adresse, horaires, photo) | **Reproduit** (réglages `brand`, première photo de la galerie ou placeholder rayé) |
| Back-office : header, onglets, bandeau KPI, maître/détail Réparations | **Reproduit** avec les vrais dossiers, permissions et audit existants |
| Onglets Commandes / Stock / Reprises | **Retirés** ; les modules existants (Dossiers, Réception, SAV, Catalogue, Options, Packs, Transport, Techniciens, Contenu, Avis, Analytics, Réglages, Audit) sont des onglets du même style |

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

## Comportement de la fiche de réparation

1. **Quel appareil ?** — modèles actifs du catalogue (précision = marque).
2. **Quelle prestation ?** — prestations publiées du modèle (choix unique) puis options
   et packs **compatibles** (choix multiples), calculés côté serveur.
3. **Décrivez le problème** — description (≥ 20 caractères, comme recommandé par le
   handoff), puces de symptômes qui s'ajoutent au texte, n° de série facultatif.
4. **Envoi et coordonnées** — coordonnées, adresse de retour, formules de transport
   réelles, récapitulatif (prix et TVA vérifiés par le serveur), conditions, CGV.
   « Envoyer ma demande » crée le dossier puis redirige vers le paiement.

## Écarts assumés

- Sur mobile, la navigation principale passe derrière un bouton « Menu » (le prototype
  laisse le header s'enrouler sur plusieurs lignes, peu utilisable en sticky).
- L'étape 2 combine une prestation principale (radio) et des options (cases) : le
  backend facture une prestation par dossier, les prestations supplémentaires passent
  par un devis complémentaire.
- Les textes « diagnostic sous 48 h », « retour sous 5 jours », « garantie 3 mois » du
  prototype n'ont pas été repris : les délais et garanties affichés sont ceux du
  catalogue et des réglages.
- Les photos (façade, vitrine) sont des placeholders rayés tant qu'aucune photo n'est
  publiée dans la galerie du back-office.
