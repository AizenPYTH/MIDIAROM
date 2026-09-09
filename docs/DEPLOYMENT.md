# Déploiement

## Supabase

1. Créer un projet, récupérer URL, clé anon et clé service-role.
2. `npx supabase link --project-ref <ref>` puis `npx supabase db push` (migrations) — **ne pas** exécuter `seed.sql` en production (données de développement).
3. Auth → URL du site et URL de redirection : `https://<domaine>/auth/callback`. Personnaliser les templates d'e-mails Supabase (confirmation, magic link, récupération).
4. Vérifier que les buckets ont bien été créés par la migration `0008_storage`.
5. Créer le premier super administrateur. Créez le compte depuis Auth → Users (« Add user », en cochant la confirmation automatique de l'adresse), puis dans le SQL Editor :

   ```sql
   update public.profiles set role = 'SUPER_ADMIN' where email = 'vous@votre-domaine.fr';
   ```

   Si la connexion échoue avec « E-mail ou mot de passe incorrect » alors que le compte existe, c'est en général une adresse non confirmée ou un compte importé sans identité. Le bloc SQL du README (« Pour définir un mot de passe d'administration ») repose le mot de passe, confirme l'adresse et crée l'identité `email`.

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

### Déployer sur Vercel

```bash
npx vercel login
npx vercel link                      # rattache le dossier au projet Vercel

# Une variable à la fois, pour l'environnement production (la valeur est demandée
# de façon interactive : aucun secret ne passe par l'historique du shell ni par Git).
for v in NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY \
         SUPABASE_SERVICE_ROLE_KEY PAYMENT_PROVIDER STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET \
         NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY EMAIL_PROVIDER EMAIL_PROVIDER_API_KEY EMAIL_FROM \
         CRON_SECRET; do
  npx vercel env add "$v" production
done

npx vercel --prod                    # déploiement de production
```

`NEXT_PUBLIC_SITE_URL` doit être le domaine public réel : il construit les liens des
e-mails, les URL canoniques et les retours de paiement. Après le premier déploiement,
reportez ce domaine dans Supabase → Auth → URL Configuration (Site URL et Redirect URLs
avec `/auth/callback`), sinon les liens de confirmation et de mot de passe échouent.

`vercel.json` planifie la tâche quotidienne. Sur un autre hébergeur, appeler `GET /api/cron/daily` avec l'en-tête `Authorization: Bearer $CRON_SECRET`.

## Développement local sans Docker

`supabase start` reste la voie recommandée. Sans Docker, une pile équivalente (PostgreSQL local + PostgREST + GoTrue compilé + émulateur Storage) a servi à l'audit ; les tests d'intégration se lancent avec `INTEGRATION=1 npm run test:integration` dès que `.env.local` pointe vers une pile Supabase-compatible.

## Diagnostic « Connexion impossible : le service d'authentification n'a pas répondu correctement »

Ce message ne concerne jamais le mot de passe. Il signale que l'application a bien
tenté la connexion mais que Supabase a répondu autre chose qu'un refus d'identifiants :
projet injoignable, clé refusée, schéma incomplet.

```bash
vercel env pull .env.vercel --environment=production
node scripts/check-supabase.mjs .env.vercel     # ou : npm run check:supabase
```

Le script vérifie la présence des variables, l'appartenance des clés au projet visé
par l'URL (la référence est lisible dans la clé), la joignabilité du projet,
l'acceptation de la clé anon, le fonctionnement du point d'entrée de connexion, la
validité de la clé service_role et la présence de la table `profiles`. Aucun secret
n'est affiché.

La cause exacte est aussi journalisée par l'application. Dans Vercel, ouvrez le
déploiement puis les journaux d'exécution et cherchez `[auth] login failed` :

| Ligne journalisée | Cause | Correction |
| --- | --- | --- |
| `status=0 message='fetch failed'` | hôte injoignable | `NEXT_PUBLIC_SUPABASE_URL` erronée, ou projet Supabase en pause : réveillez-le |
| `status=401 message='Invalid API key'` | clé refusée | `NEXT_PUBLIC_SUPABASE_ANON_KEY` d'un autre projet ou tronquée |
| `status=404` | l'URL n'expose pas l'API | reprenez « Project URL » dans Supabase → Settings → API |
| `status=503` | projet en pause ou indisponible | réveillez le projet |
| `status=500 message='Database error querying schema'` | schéma `auth` incomplet | rejouez `supabase db push` sur ce projet |

Deux pièges spécifiques à Vercel :

- une variable ajoutée ou modifiée ne s'applique qu'**au prochain déploiement**. Après
  l'avoir corrigée, relancez un déploiement (Redeploy) ;
- les variables sont définies **par environnement**. Une valeur renseignée seulement
  pour Preview laisse la Production sans valeur.

## Contrôles avant mise en ligne

- `npm run check` et `npm run test:db` verts.
- `npm run check:supabase` vert avec les variables de production (`vercel env pull`).
- Connexion au back-office vérifiée sur le domaine de production avec le compte super administrateur.
- Back-office → Réglages : entreprise, règles métier, garantie, transport, confiance ; Contenu → documents légaux validés juridiquement ; Catalogue : prix réels, pages SEO publiées.
- Webhook Stripe configuré et testé ; formule de transport rattachée à un vrai provider ou en mode manuel (`none`).

## Intégration continue

Un workflow GitHub Actions prêt à l'emploi se trouve dans `ci/github-actions-ci.yml` (lint, typecheck, tests, migrations + tests RLS sur PostgreSQL, build). Copiez-le dans `.github/workflows/ci.yml` depuis un compte disposant du droit `workflow` pour l'activer.
