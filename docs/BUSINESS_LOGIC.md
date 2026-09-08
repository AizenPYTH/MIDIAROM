# Logique métier

## Moteur de prix (`lib/pricing/engine.ts`)

Entrée : réparation, options et packs **compatibles** (déjà filtrés), sélection, transport, TVA. Sortie : lignes, sous-total, transport, total, TVA incluse, économie pack, avertissements.

Règles :
- Montants en centimes entiers ; toute valeur négative/non entière est refusée.
- Option ou pack inconnu/incompatible → `PricingError` (aucun fallback silencieux).
- Une option déjà comprise dans un pack sélectionné n'est jamais facturée deux fois (avertissement).
- Deux packs partageant une option sont refusés.
- Le calcul est exécuté **uniquement côté serveur** (`lib/pricing/service.ts`), à l'affichage et à la création de commande.

## Compatibilité (`lib/repair/compatibility.ts`)

Une option est proposée pour une réparation si :
1. elle est active,
2. elle n'est pas dans `repair_included_options` de la réparation,
3. aucune règle EXCLUDE ne correspond,
4. elle est universelle (`applies_to_all`) ou une règle INCLUDE correspond.

Une règle correspond lorsque tous ses critères renseignés (marque, modèle, panne, réparation) correspondent. Un pack est proposé uniquement si **toutes** ses options sont compatibles (un pack ne revend jamais une prestation déjà incluse).

## Statuts (`lib/orders/status.ts`)

Machine à états explicite (`canTransition`), transitions réservées aux admins (`CANCELLED`, `DISPUTED`, `PAID`, `COMPLETED`), timeline client (`computeTimeline`). `transitionOrder()` applique la transition, horodate, journalise et notifie.

## Règles configurables (`lib/quotes/rules.ts`, `site_settings.business_rules`)

Tarif diagnostic, déduction si réparation, frais de retour si refus/irréparable, frais si aucune panne, validité des devis, délai de demande d'avis, délai de console non réclamée. `consequenceForOutcome()` calcule les conséquences affichées au client avant paiement et lors du diagnostic.

## Devis complémentaires

1. Le technicien crée un devis (lignes libres ou options du catalogue, coût estimé, photo jointe, « nécessaire à la réparation » ou facultatif, paiement requis ou non).
2. Envoi → statut dossier `WAITING_CUSTOMER_APPROVAL`, e-mail au client, expiration calculée.
3. Le client accepte/refuse depuis son espace (authentifié). La décision est enregistrée par la fonction SQL atomique avec horodatage, IP et user-agent (`quote_decisions`).
4. Acceptation avec paiement → session de paiement ; le dossier passe `APPROVED` seulement après confirmation du paiement.
5. Refus : facultatif → le dossier reprend (`APPROVED`) ; nécessaire → `REFUSED_QUOTE` et application des règles configurées.

Aucune prestation supplémentaire n'est exécutée avant l'enregistrement de l'accord.

## Contrôle qualité et expédition

Le passage à `SHIPPED` exige : dossier prêt (`READY_TO_SHIP` ou retour sans réparation), checklist validée (aucun test en échec ou en attente), photo de l'état final/colis fermé, expédition retour avec numéro de suivi.

## Avis

Une ligne `reviews` est créée à la livraison ; la tâche quotidienne envoie la demande après le délai configuré ; l'avis est publié uniquement après modération. Aucun avis ne peut exister sans dossier.
