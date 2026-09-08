# Paiements

## Abstraction

`lib/stripe/types.ts` : `PaymentProvider` (`createCheckout`, `verifySession`, `refund`). Implémentations : `StripePaymentProvider` et `MockPaymentProvider` (dev uniquement).

## Stripe

- `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- Checkout Session en mode `payment`, `client_reference_id` = `payments.id`, métadonnées dossier/devis, clé d'idempotence.
- Webhook `POST /api/webhooks/stripe` : signature vérifiée, déduplication dans `payment_provider_events`, gestion de `checkout.session.completed`, `async_payment_succeeded/failed`, `expired`, `charge.refunded`.
- Le front n'est **jamais** considéré comme preuve de paiement : la page de confirmation interroge le serveur, qui vérifie la session auprès de Stripe si le webhook n'est pas encore arrivé.

Configurer le webhook Stripe sur `https://<domaine>/api/webhooks/stripe` avec les événements ci-dessus.

## Paiements complémentaires

Un devis accepté avec `requires_payment` crée un `payments` de type `QUOTE` ; la confirmation passe par le même `confirmPayment()`.

## Remboursements

Depuis la fiche dossier (admin) : remboursement partiel/total via le provider, ligne `invoices` de type `CREDIT_NOTE`, audit.

## Factures

`invoices` conserve les lignes gelées et le montant. La génération PDF ou la synchronisation comptable se branche sur `document_path` / `external_ref` (non implémentées : à intégrer avec l'outil comptable choisi).
