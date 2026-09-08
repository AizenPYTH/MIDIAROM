# Déploiement

## Supabase

1. Créer un projet, récupérer URL, clé anon et clé service-role.
2. `npx supabase link --project-ref <ref>` puis `npx supabase db push` (migrations) — **ne pas** exécuter `seed.sql` en production (données de développement).
3. Auth → URL du site et URL de redirection : `https://<domaine>/auth/callback`. Personnaliser les templates d'e-mails Supabase (confirmation, magic link, récupération).
4. Vérifier que les buckets ont bien été créés par la migration `0008_storage`.
5. Créer le premier super administrateur (voir `docs/AUTH.md`).

## Application (Vercel ou Node)

Variables d'environnement (voir `.env.example`) :

| Variable | Rôle |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | URL publique (liens e-mails, canonical) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Serveur uniquement |
| `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Paiement |
| `EMAIL_PROVIDER=resend`, `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM` | E-mails transactionnels |
| `SHIPPING_PROVIDER`, `SHIPPING_PROVIDER_API_KEY` | Transport (mock interdit en production) |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_GOOGLE_ADS_ID` | Optionnel |
| `CRON_SECRET` | Protège `/api/cron/daily` |

`vercel.json` planifie la tâche quotidienne. Sur un autre hébergeur, appeler `GET /api/cron/daily` avec l'en-tête `Authorization: Bearer $CRON_SECRET`.

## Contrôles avant mise en ligne

- `npm run check` et `npm run test:db` verts.
- Back-office → Réglages : entreprise, règles métier, garantie, transport, confiance ; Contenu → documents légaux validés juridiquement ; Catalogue : prix réels, pages SEO publiées.
- Webhook Stripe configuré et testé ; formule de transport rattachée à un vrai provider ou en mode manuel (`none`).

## Intégration continue

Un workflow GitHub Actions prêt à l'emploi se trouve dans `ci/github-actions-ci.yml` (lint, typecheck, tests, migrations + tests RLS sur PostgreSQL, build). Copiez-le dans `.github/workflows/ci.yml` depuis un compte disposant du droit `workflow` pour l'activer.
