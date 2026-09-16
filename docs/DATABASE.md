# Base de données

Migrations dans `supabase/migrations/` (ordre = préfixe horodaté). Toute modification passe par une nouvelle migration puis `npm run db:types`.

## Tables principales

| Domaine | Tables |
| --- | --- |
| Comptes | `profiles` (rôle, 1:1 `auth.users`), `addresses`, `workshops`, `technicians` |
| Catalogue | `brands`, `console_models`, `faults`, `repair_categories` (familles de pannes du catalogue client), `repairs` (modèle × panne, prix, garantie, SEO, `category_id`, `price_is_provisional`), `repair_options`, `option_categories`, `repair_option_compatibility`, `repair_included_options`, `packs`, `pack_items`, `shipping_methods`, `test_checklists`, `test_checklist_items`, `packaging_instructions` |
| Boutique | `product_categories` (les rayons : code, libellés, slug, ordre, visibilité), `products` (`category` → `product_categories.code`), `shop_orders`, `shop_order_items`, `stock_movements` |
| Dossiers | `repair_orders` (snapshot commercial, `order_number` REP-XXXXXX, `tracking_token`), `repair_order_items`, `order_status_history`, `order_events`, `order_media`, `order_messages` |
| Atelier | `reception_reports`, `diagnostics`, `supplementary_quotes`, `supplementary_quote_items`, `quote_decisions`, `repair_work_logs`, `repair_parts`, `repair_tests`, `repair_test_results` |
| Paiement / transport | `payments`, `payment_provider_events`, `invoices`, `shipments`, `shipping_events` |
| Support | `sav_requests`, `sav_messages`, `reviews`, `notifications` |
| Pilotage | `analytics_events`, `marketing_costs`, `audit_logs`, `site_settings`, `content_blocks`, `faq_items`, `seo_pages`, `gallery_items`, `legal_documents` |

Vues : `customer_diagnostics` (diagnostic sans notes internes), `public_reviews` (avis approuvés), `order_profitability` (CA, coûts, temps par dossier).

## Numéros générés en base

- `repair_orders.order_number` : trigger `assign_order_number` → `REP-` + séquence sur 6 chiffres.
- `supplementary_quotes.quote_number` : `D-000001`.
- `invoices.invoice_number` : `F-AAAA-000001`.

Le front ne génère jamais ces numéros.

## Fonctions

- `handle_new_user()` : crée le profil à l'inscription.
- `current_user_role()`, `is_staff()`, `is_admin()`, `is_super_admin()`, `owns_order()` : helpers RLS (security definer).
- `protect_profile_role()` : empêche l'auto-escalade de rôle.
- `log_order_status_change()` : historise chaque changement de statut.
- `decide_supplementary_quote(quote_id, decision, user_agent, ip)` : décision client atomique (vérifie propriétaire, statut, expiration ; enregistre `quote_decisions` ; ajoute les lignes au dossier ; met à jour le statut).

## RLS (résumé)

- Client : lit uniquement ses dossiers et données rattachées, écrit ses adresses, messages, demandes SAV, avis (en attente), décisions de devis via RPC.
- Technicien : lit/écrit les données atelier, pas le catalogue, l'audit ni les analytics.
- Admin : tout, y compris rôles (super admin requis pour gérer les super admins).
- Storage : buckets privés `reception-media`, `diagnostic-media`, `repair-media`, `shipping-media`, `final-media`, `sav-media`, `documents` (chemin `<order_id>/<KIND>/<uuid>.<ext>`) ; `content-media` public en lecture, écriture admin.

Tests : `supabase/tests/rls.test.sql` (exécutés par `npm run test:db`) vérifient notamment que le client A ne voit jamais le dossier du client B, que le technicien ne modifie pas les prix, et que les policies storage isolent les fichiers par dossier.

## Les rayons de la boutique

`product_categories` est la liste des rayons, et elle se gère depuis le
back-office (`/admin/catalog/rayons`). Elle a remplacé le type énuméré
`product_category` : ouvrir un rayon demandait une migration, un déploiement et
la modification d'une dizaine de fichiers, ce que le vendeur ne pouvait pas
faire seul.

| Colonne | Rôle |
| --- | --- |
| `code` | Clé technique, référencée par `products.category`. La renommer déplace tout le rayon (`on update cascade`) |
| `label` / `label_singular` | « Consoles » / « Console » |
| `slug` | Segment d'adresse, `/boutique?cat=consoles`. Le changer casse les liens publiés |
| `position` | Ordre d'affichage |
| `is_public` | Faux = rayon interne (c'est le cas d'`ACCESSORY` et de `PART`) |
| `tag_label` | Le nom, **dans ce rayon**, de ce que porte `products.platform` : « plateforme » pour un jeu ou une console, « licence » pour une figurine |

`products.category` est passé d'énuméré à `text` avec une clé étrangère
(`on update cascade`, `on delete restrict`) : un article ne peut pas pointer
vers un rayon inexistant, et un rayon qui contient des articles ne se supprime
pas — on le masque. Les cinq rayons d'origine ont été repris à l'identique,
codes et slugs compris : aucune adresse publiée ne change. Le type
`product_category` subsiste mais n'est plus référencé par aucune colonne —
PostgreSQL ne sait pas retirer une valeur d'un énuméré, et le laisser ne coûte
rien.

### Une colonne, deux réalités

`products.platform` porte « PlayStation 5 » pour un jeu et « One Piece » pour
une figurine. C'est la même donnée — la ligne affichée au-dessus du nom du
produit — mais pas la même chose, et les confondre donnait un filtre « Toutes
plateformes » qui proposait « Naruto Shippuden » entre « Nintendo 64 » et
« PlayStation 4 ».

Le mot juste appartient donc au **rayon**, pas au code : `tag_label`. Le filtre
de la boutique s'en sert pour son intitulé (« Toutes les licences » dans les
figurines, « Toutes les plateformes » dans les jeux, « Plateformes et licences »
sur la boutique entière) et regroupe ses valeurs sous le nom de leur rayon. Le
back-office renomme le champ de la même façon, sur la fiche complète comme sur
le formulaire court.

Côté application, `lib/shop/rayons.ts` porte le type et les fonctions pures ;
`getRayons()` (`lib/shop/categories.ts`) lit la table, met le résultat en cache
pour la requête, et **retombe sur les cinq rayons d'origine si la table n'existe
pas encore** : le code peut donc être déployé avant que la migration ne soit
appliquée sur Supabase.

> Après avoir joué `20260916000002_product_categories.sql` sur un environnement,
> PostgREST doit recharger son cache de schéma (`notify pgrst, 'reload schema'`)
> pour voir la nouvelle table. Supabase le fait de lui-même quand la migration
> passe par le tableau de bord ou la CLI.

## Catalogue de réparation

`repair_categories` regroupe les prestations d'un modèle en familles (« Image & HDMI », « Allumage & alimentation »…). `repairs.category_id` rattache chaque prestation à sa famille ; `repairs.price_is_provisional` marque une prestation dont le tarif n'est pas encore arbitré :

- côté client, la prestation s'affiche « sur devis » au lieu d'un prix ;
- côté back-office (`/admin/catalog/repairs`), elle est comptée dans « tarifs à configurer » ;
- enregistrer un prix non nul lève automatiquement le drapeau.

Le contenu vient de `supabase/catalog-reparations.sql`, appliqué en production sous sa forme générée `supabase/seed-production-repairs.sql` (voir README). La gamme PlayStation 5 s'ajoute par `supabase/catalog-ps5.sql` / `supabase/seed-production-ps5.sql` : elle ne figure pas dans le document du client et a été construite sur le modèle de la PS4. Une prestation non rattachée à une catégorie reste valide : elle apparaît sous « Sans catégorie ».

## Périmètre du catalogue

Le catalogue de réparation ne contient que les **13 modèles** détaillés dans le document du client (PS4 / Slim / Pro, Switch V1 / V2 / Lite / OLED / 2, Xbox One / S / X, Series S / X). `supabase/cleanup-strict-pdf.sql` remet une base déjà garnie au périmètre du document — modèles hors liste, prestations hors document et produits de démonstration retirés, photos des 13 consoles renseignées : `repairs.model_id` est en `ON DELETE RESTRICT`, les prestations partent donc avant les modèles ; dossiers, reprises et fiches produit conservent leur historique, seul le lien passe à NULL.

## Nettoyage des données de démonstration

`supabase/cleanup-strict-pdf.sql` est le seul fichier de nettoyage : produits de démonstration désignés par leur SKU, prestations sans catégorie (donc absentes du document) et modèles hors des 13. Ciblé, rejouable, sans DELETE global. L'historique survit : `shop_order_items.product_id` et `repair_orders.repair_id` passent à NULL, les lignes gardent leur libellé et leur prix.

## Seed

`supabase/seed.sql` contient des données de développement (catalogue exemple, prix exemples, comptes de test, textes). À adapter depuis le back-office avant mise en production ; aucun avis, chiffre ou certification fictif n'y figure.
