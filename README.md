# Plateforme de réparation de consoles à distance

Application web complète d'un magasin de jeux vidéo : **réparation à distance** (plateforme → modèle exact → prestation, symptômes et photos, paiement, numéro de dossier, réception documentée, diagnostic, devis complémentaires, réparation, contrôle qualité, expédition, suivi 8 étapes, SAV, avis), **vente** (catalogue consoles / jeux / accessoires / rétro avec filtres, fiches produit gradées, panier, commande, paiement, stock), **reprise** (estimation en ligne, offre, décision du client) et **fiches consoles** (PS1 → PS5, Xbox, Nintendo, Sega). Back-office complet : réparations, commandes, stock, reprises, clients, catalogue, contenu, réglages.

**Stack** : Next.js 16 (App Router, Server Components, Server Actions), TypeScript strict, Tailwind CSS 4, Supabase (PostgreSQL, Auth, Storage, RLS), Stripe (Checkout + webhook), Zod, Vitest.

## Démarrage rapide

```bash
npm install
cp .env.example .env.local        # renseigner les clés Supabase
npx supabase start                # base locale (Docker) — migrations + seed appliqués
npm run db:reset                  # (re)joue migrations + seed de développement
npm run dev                       # http://localhost:3000
```

Comptes de développement créés par le seed (mot de passe `password123`) :

| Rôle | E-mail |
| --- | --- |
| Super administrateur | admin@example.com |
| Technicien | technicien@example.com |
| Client | client@example.com |

Le back-office est sur `/admin` (connexion via `/connexion`). Les comptes techniciens n'accèdent ni au catalogue, ni au stock, ni aux réglages.

Le seed est **rejouable** : s'il est appliqué sur un projet où `admin@example.com` existe déjà (créé depuis le dashboard Supabase ou via le formulaire d'inscription), il repose le mot de passe de développement, confirme l'adresse, crée l'identité e-mail attendue par Supabase Auth et remet le rôle `SUPER_ADMIN`. Il ne doit jamais être appliqué sur des comptes de production.

Pour définir un mot de passe d'administration sur un projet en ligne sans rejouer tout le seed, exécutez ceci dans le SQL Editor de Supabase :

```sql
set search_path = public, extensions;

update auth.users
   set encrypted_password = crypt('VotreMotDePasseFort', gen_salt('bf')),
       email_confirmed_at  = coalesce(email_confirmed_at, now()),
       aud = 'authenticated', role = 'authenticated',
       raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
       updated_at = now()
 where email = 'admin@example.com';

insert into auth.identities (user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       now(), now(), now()
  from auth.users u where u.email = 'admin@example.com'
on conflict (provider_id, provider) do nothing;

-- Le profil applicatif peut manquer si le compte a été créé avant l'application
-- des migrations : le créer, puis poser le rôle.
insert into public.profiles (id, email, first_name, last_name, phone)
select u.id, u.email,
       nullif(u.raw_user_meta_data ->> 'first_name', ''),
       nullif(u.raw_user_meta_data ->> 'last_name', ''),
       nullif(u.raw_user_meta_data ->> 'phone', '')
  from auth.users u where u.email = 'admin@example.com'
on conflict (id) do nothing;

update public.profiles set role = 'SUPER_ADMIN' where email = 'admin@example.com';
```

Le catalogue initial (consoles, pannes, prestations avec leurs prix de départ, produits de la boutique) est dans `supabase/catalog.sql`, séparé du seed de développement.

Le catalogue de réparation est **strictement** celui du document fourni par le client : 13 modèles de console, 35 catégories et 887 prestations. Les modèles qui n'y figurent pas (PS5, PS3, rétro, Sega…) ne sont plus au catalogue. Le contenu vient de `supabase/catalog-reparations.sql`. Les tarifs n'y figurent pas : chaque prestation importée arrive à 0 € avec `price_is_provisional = true`, s'affiche « sur devis » côté client et se règle depuis `/admin/catalog/repairs` (enregistrer un prix non nul lève le drapeau). Le fichier est rejouable : la formulation du document fait foi et écrase le libellé, tandis que le prix, le résumé et l'activation saisis dans le back-office sont conservés.

Sur un projet de production, on n'applique **pas** ces deux fichiers directement : on applique leurs versions générées, `supabase/seed-production-catalog.sql` et `supabase/seed-production-repairs.sql`. Même contenu, plus une garde qui refuse de s'exécuter tant que les migrations ne sont pas passées, un état des lieux chiffré en fin de fichier, et une compatibilité assurée avec le SQL Editor de Supabase (collage direct, rejeu dans la même session) :

```bash
psql "$DB_URL" -f supabase/seed-production-catalog.sql
psql "$DB_URL" -f supabase/seed-production-repairs.sql
```

Le catalogue de production ne crée **aucun produit de boutique** : le stock réel se saisit depuis Stock → Nouveau produit, et la boutique affiche son état vide en attendant. Les 51 produits qui ont servi à bâtir la boutique vivent dans `supabase/seed.sql`, jamais appliqué en production. Sur une base déjà garnie par une version antérieure, `supabase/cleanup-demo-data.sql` les retire, avec les 98 anciennes prestations désactivées lors de l'import du catalogue du client.

Ces deux fichiers sont générés — `npm run seeds:build` les regénère, et `npm run test:db` échoue s'ils ne correspondent plus à leur source. Ils ne créent aucune table : le schéma vient uniquement des migrations. Ne confondez pas `supabase/catalog.sql` (données) avec `supabase/migrations/20260908000002_catalog.sql` (création des tables) : appliquer le second sur une base déjà migrée échoue en 42P07.

Les intégrations externes sont simulées par défaut (`PAYMENT_PROVIDER=mock`, `EMAIL_PROVIDER=console`, `SHIPPING_PROVIDER=mock`). Les mocks sont **refusés en production**.

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run dev` / `npm run build` / `npm start` | Next.js |
| `npm run lint` · `npm run typecheck` · `npm test` | Qualité |
| `npm run test:db` | Applique les migrations + seed sur un PostgreSQL jetable et exécute les tests RLS SQL |
| `INTEGRATION=1 npm run test:integration` | Tests d'intégration contre une pile Supabase locale (injections refusées, numéros uniques) |
| `npm run db:types` | Regénère `types/database.ts` depuis la base locale |
| `psql "$DB_URL" -f supabase/catalog.sql` | Charge le catalogue initial (consoles, pannes, prestations, produits) — applicable en production |
| `psql "$DB_URL" -f supabase/catalog-reparations.sql` | Charge le catalogue de réparation du client (13 modèles, 35 catégories, 887 prestations « sur devis ») — applicable en production, rejouable |
| `npm run seeds:build` | Regénère les deux fichiers de données de production depuis `catalog.sql` et `catalog-reparations.sql` |
| `npm run photos:consoles -- <dossier> [--dry-run]` | Importe les photos des 13 modèles du catalogue de réparation : identifie le vrai contenu de chaque fichier, extrait l'image d'une page enregistrée depuis Chrome, convertit en WebP (1200 px max), téléverse dans `content-media/consoles/<slug>.webp` et renseigne `console_models.image_path`. Ne télécharge jamais depuis Internet. |
| `psql "$DB_URL" -f supabase/cleanup-strict-pdf.sql` | Remet une base déjà garnie au périmètre du document : 13 modèles, 887 prestations, 0 produit de démonstration, photos des consoles renseignées — ciblé et rejouable |
| `npm run check` | lint + typecheck + tests + build |
| `npm run check:supabase [fichier .env]` | Diagnostique la configuration Supabase d'un déploiement (variables, clés, joignabilité, schéma) |
| `scripts/apply-migrations.sh <url-postgres>` | Applique les migrations sur une base distante en une transaction, sans `supabase link` |

## État des intégrations

Voir [`docs/STATUS.md`](docs/STATUS.md) : ce qui est implémenté, à configurer, simulé ou absent.

## Documentation

Voir le dossier [`docs/`](docs/) : architecture, base de données, logique métier, commandes, transport, paiements, authentification, SEO, analytics, déploiement.

Le design (handoff Claude Design « 207 Mediarom ») et sa correspondance avec les pages sont décrits dans [`docs/DESIGN.md`](docs/DESIGN.md).
