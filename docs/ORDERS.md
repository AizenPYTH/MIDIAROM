# Commandes et dossiers

## Création (`lib/orders/create-order.ts`)

1. Validation Zod (`lib/orders/schemas.ts`) : sélection, coordonnées, adresse (FR), CGV acceptées, attribution.
2. Recalcul du prix côté serveur.
3. Résolution du client : utilisateur connecté, compte existant (même e-mail) ou création d'un compte (e-mail « définir mon mot de passe »).
4. Insertion `repair_orders` (statut `PENDING_PAYMENT`, snapshot console/réparation/adresse/prix/UTM, version des CGV) + `repair_order_items`.
5. Création d'un `payments` PENDING et d'une session de paiement ; redirection.

## Confirmation de paiement (`lib/orders/payments.ts`)

`confirmPayment()` est le seul point d'entrée (webhook Stripe, vérification serveur de secours, simulation dev). Idempotent, vérifie le montant, crée la facture, puis :
- paiement initial → `PAID` → étiquette aller si la formule l'inclut → `AWAITING_SHIPMENT` → e-mails (confirmation, étiquette) → événement analytics `purchase` ;
- complément de devis → devis payé → `APPROVED` s'il ne reste aucun devis en attente.

## Cycle de vie atelier

| Étape | Écran admin | Effet |
| --- | --- | --- |
| Réception | Dossier → Réception | `RECEIVED` puis `RECEPTION_CHECK`, e-mail « console arrivée », photos |
| Diagnostic | Dossier → Diagnostic | `DIAGNOSIS`, fiche, e-mail à la fin ; irréparable → `UNREPAIRABLE` |
| Devis | Dossier → Devis | `WAITING_CUSTOMER_APPROVAL` |
| Réparation | Dossier → Réparation | journal (temps), pièces (coûts), photos |
| Tests | Dossier → Tests | `QUALITY_CONTROL` → `READY_TO_SHIP` |
| Expédition | Dossier → Expédition | étiquette retour ou saisie manuelle, `SHIPPED`, `DELIVERED` |

Tout changement de statut est visible dans l'onglet Historique (événements, historique des statuts, audit).

## Suivi public

`/suivi` demande numéro de dossier **et** e-mail ; en cas de correspondance, redirection vers `/suivi/<token>` (même lien que dans les e-mails). Cette page n'expose ni adresse, ni prix, ni photos.

## Tâche quotidienne (`/api/cron/daily`)

Demandes d'avis, expiration des devis, clôture automatique des dossiers livrés, annulation des commandes non payées après 48 h. À appeler avec `Authorization: Bearer CRON_SECRET` (configuré dans `vercel.json`).
