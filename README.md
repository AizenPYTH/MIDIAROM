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

Les intégrations externes sont simulées par défaut (`PAYMENT_PROVIDER=mock`, `EMAIL_PROVIDER=console`, `SHIPPING_PROVIDER=mock`). Les mocks sont **refusés en production**.

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run dev` / `npm run build` / `npm start` | Next.js |
| `npm run lint` · `npm run typecheck` · `npm test` | Qualité |
| `npm run test:db` | Applique les migrations + seed sur un PostgreSQL jetable et exécute les tests RLS SQL |
| `INTEGRATION=1 npm run test:integration` | Tests d'intégration contre une pile Supabase locale (injections refusées, numéros uniques) |
| `npm run db:types` | Regénère `types/database.ts` depuis la base locale |
| `npm run check` | lint + typecheck + tests + build |

## État des intégrations

Voir [`docs/STATUS.md`](docs/STATUS.md) : ce qui est implémenté, à configurer, simulé ou absent.

## Documentation

Voir le dossier [`docs/`](docs/) : architecture, base de données, logique métier, commandes, transport, paiements, authentification, SEO, analytics, déploiement.

Le design (handoff Claude Design « 207 Mediarom ») et sa correspondance avec les pages sont décrits dans [`docs/DESIGN.md`](docs/DESIGN.md).
