# Déploiement

## Supabase

1. Créer un projet, récupérer URL, clé anon et clé service-role.
2. Appliquer les migrations. **Ne jamais** exécuter `seed.sql` en production : ce sont des données de développement.

   La voie recommandée ne demande aucun `supabase link` :

   ```bash
   # Chaîne de connexion : Supabase → Connect → Session pooler (port 5432).
   # Le mot de passe doit être encodé pour une URL (@ → %40, # → %23, etc.).
   npx supabase db push --db-url "postgresql://postgres.<ref>:<mot-de-passe>@aws-0-<region>.pooler.supabase.com:5432/postgres" --dry-run
   npx supabase db push --db-url "postgresql://postgres.<ref>:<mot-de-passe>@aws-0-<region>.pooler.supabase.com:5432/postgres"
   ```

   `--db-url` contourne le lien au projet, donc les erreurs de privilèges du jeton
   d'accès personnel. Le pooler en **mode session** (port 5432) est nécessaire : le
   mode transaction (port 6543) ne supporte pas tout le DDL, et l'hôte direct
   `db.<ref>.supabase.co` n'est joignable qu'en IPv6 depuis beaucoup de connexions.

   Si `supabase link` échoue sur les privilèges et que vous souhaitez le réparer :
   vérifiez que le jeton (`npx supabase login`) appartient bien à un membre de
   l'organisation propriétaire du projet, et que le mot de passe saisi est celui de la
   base (Settings → Database), pas celui du compte Supabase.

   Repli sans la CLI, en une seule transaction :

   ```bash
   scripts/apply-migrations.sh "postgresql://postgres.<ref>:<mot-de-passe>@aws-0-<region>.pooler.supabase.com:5432/postgres" --dry-run
   scripts/apply-migrations.sh "postgresql://postgres.<ref>:<mot-de-passe>@aws-0-<region>.pooler.supabase.com:5432/postgres"
   ```

   Le script refuse de s'exécuter si `public.profiles` existe déjà (les migrations
   créent les tables sans `if not exists` : les rejouer échouerait), applique les neuf
   fichiers dans une transaction unique — une erreur annule tout et ne laisse pas la
   base à moitié migrée — puis enregistre les versions dans
   `supabase_migrations.schema_migrations` pour qu'un `db push` ultérieur reparte
   d'un historique correct.

   Prenez une sauvegarde avant toute application sur une base qui contient déjà des
   données (Database → Backups), et vérifiez ensuite avec `npm run check:supabase`.
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

## Table `profiles` d'une autre origine (erreur 42703 sur `role`)

Si `public.profiles` existe mais n'a pas de colonne `role`, cette table ne vient pas de
ces migrations : c'est en général celle du démarrage rapide Supabase, restée d'un essai
précédent. Elle empêche la migration de créer la nôtre, et toute requête sur `role`
échoue en `42703`. Vérifiez l'ampleur du problème :

```sql
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'profiles' order by ordinal_position;

select count(*) from public.profiles;

-- Nos tables sont-elles présentes ? Zéro signifie qu'aucune migration n'a été appliquée.
select count(*) from information_schema.tables
 where table_schema = 'public' and table_name in ('repair_orders', 'repairs', 'products', 'site_settings');

-- Des tables référencent-elles profiles ? Aucune ligne = rien ne dépend d'elle.
select tc.table_name, tc.constraint_name
  from information_schema.table_constraints tc
  join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
 where ccu.table_schema = 'public' and ccu.table_name = 'profiles' and tc.constraint_type = 'FOREIGN KEY';
```

Ajouter la colonne `role` à cette table ne suffirait pas : il manque aussi le type
`user_role`, les autres colonnes, le déclencheur de création de profil, les politiques
RLS et le reste du schéma. La reprise propre consiste à mettre la table de côté, à
appliquer les migrations, puis à recréer les profils.

```sql
-- 1. Sauvegarde intégrale, puis retrait. Aucune donnée n'est perdue : tout reste dans
--    profiles_avant_migration. « cascade » ne retire ici que les contraintes listées
--    par la requête de dépendances ci-dessus.
begin;
create table public.profiles_avant_migration as select * from public.profiles;
drop table public.profiles cascade;
commit;
```

Appliquez ensuite les migrations (`supabase db push --db-url …` ou
`scripts/apply-migrations.sh`), puis recréez les profils. Le déclencheur
`on_auth_user_created` ne concerne que les comptes créés après lui : les comptes
existants n'ont pas de profil tant que cette requête n'a pas été passée.

```sql
-- 2. Un profil pour chaque compte déjà présent dans Supabase Auth.
set search_path = public, extensions;

insert into public.profiles (id, email, first_name, last_name, phone)
select u.id, u.email,
       nullif(u.raw_user_meta_data ->> 'first_name', ''),
       nullif(u.raw_user_meta_data ->> 'last_name', ''),
       nullif(u.raw_user_meta_data ->> 'phone', '')
  from auth.users u
 where u.email is not null
on conflict (id) do nothing;

-- 3. Facultatif : reprendre les noms de l'ancienne table. À adapter à ses colonnes ;
--    l'exemple part d'une colonne « full_name ».
update public.profiles p
   set first_name = coalesce(p.first_name, nullif(split_part(a.full_name, ' ', 1), '')),
       last_name  = coalesce(p.last_name, nullif(trim(substr(a.full_name, strpos(a.full_name, ' '))), ''))
  from public.profiles_avant_migration a
 where a.id = p.id and a.full_name is not null;

-- 4. Rôle du back-office.
update public.profiles set role = 'SUPER_ADMIN' where email = 'vous@votre-domaine.fr';

-- 5. Contrôle.
select email, role, first_name, last_name from public.profiles order by email;
```

Gardez `public.profiles_avant_migration` le temps de vérifier, puis supprimez-la avec
`drop table public.profiles_avant_migration;`.

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

## Espace client vide ou page blanche après connexion

Un compte authentifié dont la ligne `public.profiles` est absente rendait l'espace
client inutilisable : la page privée renvoyait vers la connexion, que le proxy
renvoyait vers l'espace client, d'où une boucle de redirection et une page blanche.
Cet état survient quand le compte a été créé hors de l'application (dashboard
Supabase, import) avant que le déclencheur `on_auth_user_created` n'existe.

L'application recrée désormais le profil manquant à la volée, avec le rôle par défaut
`CUSTOMER`. Pour un administrateur, posez ensuite le rôle :

```sql
update public.profiles set role = 'SUPER_ADMIN' where email = 'vous@votre-domaine.fr';
```

Si la réparation est impossible (clé `SUPABASE_SERVICE_ROLE_KEY` absente ou refusée,
table `profiles` inexistante), la page de connexion affiche un message explicite au
lieu de boucler. Vérifiez alors la clé de service et l'application des migrations avec
`npm run check:supabase`.

## Contrôles avant mise en ligne

- `npm run check` et `npm run test:db` verts.
- `npm run check:supabase` vert avec les variables de production (`vercel env pull`).
- Connexion au back-office vérifiée sur le domaine de production avec le compte super administrateur.
- Back-office → Réglages : entreprise, règles métier, garantie, transport, confiance ; Contenu → documents légaux validés juridiquement ; Catalogue : prix réels, pages SEO publiées.
- Webhook Stripe configuré et testé ; formule de transport rattachée à un vrai provider ou en mode manuel (`none`).

## Intégration continue

Un workflow GitHub Actions prêt à l'emploi se trouve dans `ci/github-actions-ci.yml` (lint, typecheck, tests, migrations + tests RLS sur PostgreSQL, build). Copiez-le dans `.github/workflows/ci.yml` depuis un compte disposant du droit `workflow` pour l'activer.
