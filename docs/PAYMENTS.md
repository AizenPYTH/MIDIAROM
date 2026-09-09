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

## Factures — état réel

- **Implémenté** : une ligne `invoices` par paiement confirmé (initiale, complémentaire) et par remboursement (avoir), numéro séquentiel `F-AAAA-NNNNNN`, lignes gelées, TVA. La référence est affichée au client et dans le back-office.
- **Non implémenté** : génération du PDF et export comptable. `lib/invoices/index.ts` expose `getInvoiceDocumentUrl()` (lien signé affiché automatiquement quand `document_path` est renseigné) et `attachInvoiceDocument()` (à appeler par le futur générateur PDF ou la synchronisation comptable). Tant qu'aucun PDF n'existe, l'interface indique « PDF envoyé sur demande » et ne prétend rien d'autre.
