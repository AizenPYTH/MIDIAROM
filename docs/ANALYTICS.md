# Analytics

## Interne (toujours actif, sans cookie)

`lib/analytics/client.tsx` capture l'attribution de première visite (page d'atterrissage, référent, UTM) dans `localStorage` et envoie les événements à `/api/analytics` (validation Zod, rate limit) → table `analytics_events`. Les conversions (achat, devis) sont enregistrées **côté serveur** (`lib/analytics/server.ts`).

Événements : `page_view`, `view_repair`, `start_checkout`, `add_option`, `remove_option`, `select_pack`, `remove_pack`, `select_shipping`, `start_payment`, `purchase`, `quote_sent`, `quote_accepted`, `quote_refused`, `quote_paid`, `review_submitted`, `tracking_lookup`.

## Google (GA4 / Ads)

Renseigner `NEXT_PUBLIC_GA_MEASUREMENT_ID` et/ou `NEXT_PUBLIC_GOOGLE_ADS_ID` : le bandeau de consentement apparaît et les tags ne se chargent qu'après accord. Les mêmes événements sont poussés via `gtag`.

## Tableau de bord rentabilité (Back-office → Analytics)

Filtres période / réparation / console / source / campagne. Indicateurs : CA, commandes, panier moyen, conversion, CAC (dépenses saisies dans Analytics → Dépenses marketing), coût pièces, coût transport, temps technicien, SAV, marge estimée ; entonnoir ; performance des options et packs ; sources et pages d'atterrissage ; rentabilité par réparation (vue `order_profitability`).
