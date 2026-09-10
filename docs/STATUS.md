# État réel de l'application (audit)

Dernière vérification : exécution complète du parcours client, du workflow atelier, des devis complémentaires, des permissions et du stockage sur une pile locale composée de PostgreSQL 16, PostgREST 14.16, GoTrue (supabase/auth compilé depuis les sources) et d'un émulateur de l'API Storage appliquant les mêmes policies SQL que le service réel. Les tests unitaires, d'intégration et SQL sont dans le dépôt.

Légende : **IMPLEMENTED** fonctionne sans configuration supplémentaire · **CONFIGURE** fonctionne dès que les clés/données sont renseignées · **MOCK** simulé en développement, refusé en production · **PARTIAL** partiellement implémenté · **NOT IMPLEMENTED** absent.

| Domaine | Statut | Détail |
| --- | --- | --- |
| Catalogue (marques, modèles, pannes, réparations, options, packs, compatibilités) | IMPLEMENTED | CRUD admin, règles de compatibilité, options incluses, aperçu de l'offre calculée |
| Pages réparation SEO (`/reparation/[modèle]/[panne]`) | IMPLEMENTED | Générées uniquement pour les réparations publiées ; sitemap, canonical, JSON-LD, FAQ |
| Moteur de prix côté serveur | IMPLEMENTED | Testé unitairement et en intégration ; le navigateur n'envoie que des identifiants |
| Fiche de réparation 4 étapes (design 207 Mediarom) | IMPLEMENTED | Plateforme → modèle exact → prestation liée au modèle + options compatibles → description + symptômes multiples + photos → coordonnées / transport / récapitulatif / CGV ; prix serveur, création de dossier (symptômes et photos rattachés) puis paiement. Voir `docs/DESIGN.md` |
| Design system (papier / encre, Archivo + IBM Plex Mono, sans arrondi ni ombre) | IMPLEMENTED | Site public, espace client et back-office |
| Fiches consoles (`/consoles`, `/consoles/[modèle]`) | IMPLEMENTED | 37 modèles (PS1→PS5, Xbox, Nintendo dont rétro/portables, Sega) : variantes, pannes fréquentes, réparations avec prix/délai/garantie, produits en vente, modèles de la même marque |
| Boutique (`/boutique`, fiche produit, panier, `/commande-boutique`, confirmation) | IMPLEMENTED | Recherche, filtres (catégorie, plateforme, état, dispo, rétro, prix), tri ; fiche avec grade A/B/C, défauts, caractéristiques, stock, SKU, JSON-LD ; panier local (identifiants seulement) chiffré par le serveur ; commande C-XXXXXX, retrait ou envoi (frais / seuil offert administrables), paiement via le même provider que les réparations, facture boutique, décrément de stock et e-mails |
| Commandes boutique (back-office) | IMPLEMENTED | Liste + KPI + filtres, fiche, statuts en attente → payée → préparée → expédiée → livrée / annulée, suivi transporteur, notes, export CSV, bons d'envoi imprimables, remise en stock à l'annulation |
| Stock / produits (back-office) | IMPLEMENTED | Références (SKU, plateforme, état, prix, quantité, seuil, photos), états disponible / faible / rupture, ajustements tracés (`stock_movements`), KPI valeur de stock |
| Reprise (`/reprise`, suivi par lien, `/compte/reprises`, back-office) | IMPLEMENTED | Demande client (type, plateforme/modèle, état, photos, accessoires, description, coordonnées), numéro T-XXXXXX, offre de l'atelier avec validité, acceptation / refus en ligne, clôture, historique, e-mails |
| Espace client : commandes boutique et reprises | IMPLEMENTED | `/compte/commandes` (+ détail : articles, totaux, étapes, suivi colis, historique, facture) et `/compte/reprises` |
| Suivi atelier 8 étapes (Reçu → Diagnostic → Devis envoyé → En attente client → En atelier → Réparé → Expédié → Terminé) | IMPLEMENTED | Suivi public par jeton, espace client, pipeline cliquable du back-office (transitions soumises aux permissions) |
| Photos client à la demande | IMPLEMENTED | Dépôt navigateur dans le bucket privé `customer-media` (brouillons purgés par la tâche quotidienne), rattachées au dossier / à la reprise à la création, visibles dans l'espace client et le back-office |
| Création de compte au checkout | IMPLEMENTED | Compte créé, e-mail « définir mon mot de passe » via `token_hash` + `/auth/callback` |
| Paiement | CONFIGURE / MOCK | Stripe Checkout + webhook signé + idempotence implémentés ; nécessite les clés Stripe. Simulation `PAYMENT_PROVIDER=mock` en développement uniquement |
| Numéros REP-/D-/F- | IMPLEMENTED | Séquences PostgreSQL, unicité vérifiée sous 20 insertions concurrentes |
| Espace client (dossiers, timeline, documents, devis, messagerie, SAV, profil, adresses, suppression de compte) | IMPLEMENTED | |
| Suivi public `/suivi` | IMPLEMENTED | Numéro + e-mail, puis lien à jeton ; aucune donnée sensible exposée |
| Réception, diagnostic, réparation (pièces, temps), contrôle qualité, expédition | IMPLEMENTED | Workflow testé de bout en bout ; expédition bloquée sans tests validés, photo finale et suivi |
| Devis complémentaires | IMPLEMENTED | Accord atomique horodaté (IP, user-agent), paiement du complément, refus facultatif/nécessaire |
| Photos / vidéos | IMPLEMENTED | Upload direct navigateur → Storage, buckets privés, MIME/taille limités, URLs signées, isolation par dossier vérifiée |
| E-mails transactionnels | CONFIGURE / MOCK | 16 templates prêts ; `EMAIL_PROVIDER=resend` + clé requis. `console` en développement uniquement |
| E-mails Supabase Auth (confirmation, lien magique, réinitialisation) | CONFIGURE | Dépendent du SMTP configuré dans le projet Supabase |
| Transport | MOCK / PARTIAL | Interface `ShippingProvider` + mock (étiquette PDF de démonstration). Aucun transporteur réel branché. Saisie manuelle d'un envoi (réparations) et du numéro de suivi (commandes boutique) dans le back-office |
| Factures | PARTIAL | Lignes `invoices` (initiale, complémentaire, boutique, avoir) avec numéro et TVA. **Aucun PDF généré** ; point d'intégration `lib/invoices` (`document_path`, `external_ref`) |
| Remboursements | CONFIGURE | Via le provider de paiement, avoir enregistré, audité |
| Notifications internes (outbox) | IMPLEMENTED | Table `notifications` avec statut d'envoi et erreur |
| Analytics interne + tableau de bord rentabilité | IMPLEMENTED | Événements first-party, CAC via dépenses saisies |
| Google Analytics / Ads | CONFIGURE | Chargés après consentement si identifiants renseignés |
| Avis clients | IMPLEMENTED | Demande différée (cron), formulaire à jeton, modération ; aucun avis fictif |
| SAV | IMPLEMENTED | Ouverture client, pièces jointes, traitement et statuts côté atelier |
| Tâche quotidienne | CONFIGURE | `/api/cron/daily` protégé par `CRON_SECRET` (planifiée dans `vercel.json`) |
| Rate limiting | PARTIAL | En mémoire (mono-instance) sur connexion, inscription, checkout, suivi, analytics |
| Documents légaux | CONFIGURE | Structures CGV / confidentialité / mentions légales versionnées, contenu à valider juridiquement |
| Multi-atelier, multi-pays, comptabilité, paiement en plusieurs fois, TVA sur marge (occasion) | NOT IMPLEMENTED | Schéma préparé (`workshops`, `technicians`, `repair_parts`), pas d'écran dédié ; la TVA boutique est calculée au taux global |

## Back-office : hiérarchie

Premier niveau : Réparations, Commandes, Stock, Clients. Le menu « Plus » regroupe
Gestion (clients, techniciens, catalogue, reprises, contenu, avis), Atelier (réception,
SAV, dossiers), Configuration (options, packs, transport, paramètres) et Administration
(utilisateurs, statistiques, audit). Aucune route n'a été retirée. Les prestations de
réparation se gèrent console par console dans Catalogue → Réparations (prix, résumé,
ordre, activation, ajout, retrait) ; la vue tableau complète reste accessible.

## Ce qui a été testé réellement

- `tests/*.test.ts` : moteur de prix, compatibilité, machine à états, numéros, règles métier, uploads, markdown, totaux boutique / panier / stock / étapes atelier (42 tests).
- `tests/integration/orders.test.ts` (`INTEGRATION=1 npm run test:integration`) : refus des options incompatibles/inactives et des transports inconnus à la création de commande, unicité des numéros de dossier, devis et factures sous concurrence.
- `supabase/tests/rls.test.sql` (`npm run test:db`) : isolation client A / client B, technicien sans droit sur les prix et réglages, storage isolé par dossier, RPC de décision de devis.
- Scénarios navigateur (Playwright, non versionnés) : parcours réparation complet (plateforme → PS5 → HDMI + option + symptômes + photo + transport → paiement simulé → REP-XXXXXX → compte créé → dossier avec symptômes et photo) ; réception, photos, diagnostic, devis accepté puis payé, devis refusé, réparation, tests, expédition, livraison, clôture par l'admin ; boutique (filtres, fiche, panier, rupture, envoi offert, paiement → C-XXXXXX, stock décrémenté, facture) ; back-office commandes (préparée → expédiée + suivi, CSV, bons d'envoi), stock (ajustement tracé), reprises (photo, offre, acceptation client, clôture), clients ; reprise client avec photo → T-XXXXXX → suivi ; espace client commandes / reprises ; fiches consoles ; suivi public 8 étapes ; pipeline admin ; accès directs par URL refusés ; captures mobiles 375/390/430 et tablette 820 sans débordement horizontal.

## Corrections issues de l'audit de connexion

- `crypt()` / `gen_salt()` et le type `citext` étaient appelés sans qualification. Sur Supabase (hébergé comme CLI) ces objets vivent dans le schéma `extensions`, hors du `search_path` par défaut : les migrations et le seed échouaient, donc les comptes de développement n'existaient pas. Migrations et seed fixent désormais `search_path = public, extensions`.
- Le seed créait les comptes avec `on conflict (id) do nothing`, alors que la contrainte violée porte sur l'e-mail : rejouer le seed sur un compte déjà créé levait une erreur au lieu de reposer le mot de passe. Les comptes sont désormais rapprochés par e-mail, le mot de passe de développement et la confirmation d'adresse sont réappliqués, et les rôles ne dépendent plus d'un identifiant figé.
- Les comptes du seed n'avaient pas de ligne `auth.identities`, contrairement aux comptes créés par l'application. L'identité « email » est maintenant créée, comme l'attend Supabase Auth pour la réinitialisation de mot de passe et la gestion depuis le dashboard.
- La connexion affichait « E-mail ou mot de passe incorrect » pour **toute** erreur, y compris une adresse non confirmée, une clé API invalide ou un service injoignable. Les cas corrigeables par l'utilisateur sont distingués, les erreurs de configuration sont journalisées côté serveur, et un mot de passe erroné reste indiscernable d'un compte inexistant.
- Cinq insertions du seed (compatibilités, points de contrôle, emballage, FAQ, documents légaux) n'étaient pas rejouables. `npm run test:db` applique désormais le seed **deux fois** et vérifie les comptes (`supabase/tests/accounts.test.sql`).

## Corrections issues de l'audit

- Garde d'expédition : les étiquettes PDF (média `SHIPPING`) satisfaisaient la condition « photo de l'état final / du colis fermé » ; seules les images comptent désormais et les étiquettes ne sont plus mélangées aux photos.
- Case « nécessite un paiement » des devis toujours enregistrée à `false` (champ caché) ; corrigé et vérifié en base (devis accepté → paiement → ligne ajoutée).
- Échec de stockage d'une étiquette : l'expédition était enregistrée sans étiquette ; l'erreur est maintenant remontée et l'étiquette annulée chez le transporteur.
- Lien « définir mon mot de passe » inutilisable avec le callback SSR ; passage au flux `token_hash`.
- Débordements horizontaux mobiles (stepper de commande, espace client, onglets du back-office) corrigés.
- Pages modèle sans réparation publiée retirées du sitemap et passées en `noindex`.
