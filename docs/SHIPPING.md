# Transport

## Abstraction

`lib/shipping/types.ts` définit `ShippingProvider` : `createLabel()`, `getTracking()`, `getRates()`, `cancelLabel()`.

`lib/shipping/index.ts` contient le registre des providers. Aujourd'hui : `mock` (développement, refusé en production). Pour brancher un transporteur :

1. Créer `lib/shipping/providers/<carrier>.ts` implémentant l'interface (appel API, retour du PDF d'étiquette, coût).
2. L'enregistrer dans le registre avec un `code`.
3. Créer/éditer une formule dans Back-office → Transport avec `provider_code` = ce code et le code service.
4. Ajouter la clé API dans `.env` (`SHIPPING_PROVIDER_API_KEY` ou variable dédiée).

## Formules (`shipping_methods`)

Chaque formule définit : prix client, coût estimé (marge), étiquette aller fournie ou non, retour inclus, valeur assurée, provider. Le client choisit la formule au checkout ; le prix est intégré au calcul serveur.

## Expéditions (`shipments`)

Une ligne par étiquette/envoi, direction `TO_WORKSHOP` ou `TO_CUSTOMER`, numéro et URL de suivi, PDF stocké dans `shipping-media` (privé, URL signée pour le client), poids/dimensions, valeur déclarée, coût réel (rentabilité). `shipping_events` conserve l'historique.

Sans API transporteur, l'atelier saisit l'envoi manuellement (transporteur, numéro de suivi, coût) ; le client reçoit le suivi par e-mail.

## Instructions d'emballage

Table `packaging_instructions` (génériques + par modèle, illustrations dans `content-media`), page `/emballage?modele=<slug>`.
