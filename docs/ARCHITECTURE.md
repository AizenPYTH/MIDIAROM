# Architecture

## Vue d'ensemble

```
app/                      Routes Next.js (App Router)
  (marketing)/            Site public : accueil, /reparation, checkout, suivi, pages légales
  (auth)/                 Connexion, inscription, mot de passe
  (account)/compte/       Espace client (RLS)
  admin/                  Back-office (staff), actions serveur dans admin/actions/
  api/                    Webhook Stripe, analytics, cron
components/               UI (ui/), marketing, repair, checkout, customer, admin, tracking
lib/                      Domaine et infrastructure (voir ci-dessous)
emails/                   Templates d'e-mails (fonctions pures → {subject, html, text})
supabase/migrations/      Schéma versionné, RLS, storage
supabase/seed.sql         Données de DÉVELOPPEMENT
supabase/tests/           Tests SQL des règles RLS
types/database.ts         Types générés depuis la base
tests/                    Tests unitaires Vitest
docs/                     Cette documentation
```

## Couches

| Couche | Emplacement | Règle |
| --- | --- | --- |
| Domaine pur (testé) | `lib/pricing/engine.ts`, `lib/repair/compatibility.ts`, `lib/orders/status.ts`, `lib/quotes/rules.ts` | Aucune dépendance à la base ; entrées/sorties typées |
| Services serveur | `lib/orders/*`, `lib/shipping/service.ts`, `lib/media/service.ts`, `lib/notifications` | `import "server-only"`, utilisent le client admin après contrôle des permissions |
| Intégrations | `lib/stripe`, `lib/email`, `lib/shipping` | Interface + implémentation réelle + mock de développement |
| Accès données | `lib/supabase/{server,client,admin,generic}.ts` | Client utilisateur (RLS) pour les lectures côté client ; client service-role pour les écritures métier |
| Présentation | `app/`, `components/` | Aucune règle métier ; les prix viennent toujours du serveur |

## Principes

- **Le serveur est la source de vérité** : prix (`lib/pricing/service.ts`), statuts (`transitionOrder`), paiements (`confirmPayment` alimenté par le webhook).
- **Deux verrous** : RLS en base + vérification des rôles dans le code (`lib/security/auth.ts`) avant tout usage du client service-role.
- **Traçabilité** : `order_events` (timeline), `order_status_history` (trigger), `audit_logs` (`lib/security/audit.ts`), `quote_decisions` (accord client horodaté).
- **Extensibilité** : registres de providers (`lib/shipping/index.ts`, `lib/stripe/index.ts`, `lib/email/index.ts`), tables `workshops`/`technicians` pour le multi-atelier, `provider_code` par formule de transport.
- **Pas de fausses fonctionnalités** : chaque mock est explicitement nommé, refusé en production et remplaçable par une implémentation de la même interface.

## Décisions notables

- Next.js 16 : `proxy.ts` (ex-middleware) rafraîchit la session Supabase et protège `/compte` et `/admin` ; les rôles sont vérifiés côté serveur dans les layouts et actions.
- Pages catalogue en ISR (`revalidate = 600`) + `revalidatePath` depuis les actions admin.
- Uploads : le navigateur écrit directement dans Supabase Storage (buckets privés, MIME/taille limités, policies par dossier), puis une action serveur enregistre la ligne `order_media` après re-vérification.
- CRUD admin déclaratif (`lib/admin/entities.ts`) : un schéma Zod + une liste de champs par entité, un client Supabase « sans schéma » réservé à ce module.
