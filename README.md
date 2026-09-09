# Plateforme de réparation de consoles à distance

Application web complète permettant à un particulier en France de faire réparer sa console à distance : choix de la console, de la panne et des options, paiement en ligne, numéro de dossier, instructions d'envoi, réception documentée, diagnostic, devis complémentaires avec accord tracé, réparation, contrôle qualité, expédition retour, suivi, SAV et avis.

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
