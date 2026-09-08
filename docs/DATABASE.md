# Base de données

Migrations dans `supabase/migrations/` (ordre = préfixe horodaté). Toute modification passe par une nouvelle migration puis `npm run db:types`.

## Tables principales

| Domaine | Tables |
| --- | --- |
| Comptes | `profiles` (rôle, 1:1 `auth.users`), `addresses`, `workshops`, `technicians` |
| Catalogue | `brands`, `console_models`, `faults`, `repairs` (modèle × panne, prix, garantie, SEO), `repair_options`, `option_categories`, `repair_option_compatibility`, `repair_included_options`, `packs`, `pack_items`, `shipping_methods`, `test_checklists`, `test_checklist_items`, `packaging_instructions` |
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

## Seed

`supabase/seed.sql` contient des données de développement (catalogue exemple, prix exemples, comptes de test, textes). À adapter depuis le back-office avant mise en production ; aucun avis, chiffre ou certification fictif n'y figure.
