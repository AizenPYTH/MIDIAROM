# État réel de l'application (audit)

Dernière vérification : exécution complète du parcours client, du workflow atelier, des devis complémentaires, des permissions et du stockage sur une pile locale composée de PostgreSQL 16, PostgREST 14.16, GoTrue (supabase/auth compilé depuis les sources) et d'un émulateur de l'API Storage appliquant les mêmes policies SQL que le service réel. Les tests unitaires, d'intégration et SQL sont dans le dépôt.

Légende : **IMPLEMENTED** fonctionne sans configuration supplémentaire · **CONFIGURE** fonctionne dès que les clés/données sont renseignées · **MOCK** simulé en développement, refusé en production · **PARTIAL** partiellement implémenté · **NOT IMPLEMENTED** absent.

| Domaine | Statut | Détail |
| --- | --- | --- |
| Catalogue (marques, modèles, pannes, réparations, options, packs, compatibilités) | IMPLEMENTED | CRUD admin, règles de compatibilité, options incluses, aperçu de l'offre calculée |
| Pages réparation SEO (`/reparation/[modèle]/[panne]`) | IMPLEMENTED | Générées uniquement pour les réparations publiées ; sitemap, canonical, JSON-LD, FAQ |
| Moteur de prix côté serveur | IMPLEMENTED | Testé unitairement et en intégration ; le navigateur n'envoie que des identifiants |
| Fiche de réparation 4 étapes (design 207 Mediarom) | IMPLEMENTED | Appareil → prestation + options compatibles → description → coordonnées / transport / récapitulatif / CGV ; prix serveur, création de dossier puis paiement. Voir `docs/DESIGN.md` |
| Design system (papier / encre, Archivo + IBM Plex Mono, sans arrondi ni ombre) | IMPLEMENTED | Site public, espace client et back-office ; boutique / stock / reprises de la maquette volontairement non implémentés |
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
| Transport | MOCK / PARTIAL | Interface `ShippingProvider` + mock (étiquette PDF de démonstration). Aucun transporteur réel branché. Saisie manuelle d'un envoi disponible dans le back-office |
| Factures | PARTIAL | Lignes `invoices` (initiale, complémentaire, avoir) avec numéro et TVA. **Aucun PDF généré** ; point d'intégration `lib/invoices` (`document_path`, `external_ref`) |
| Remboursements | CONFIGURE | Via le provider de paiement, avoir enregistré, audité |
| Notifications internes (outbox) | IMPLEMENTED | Table `notifications` avec statut d'envoi et erreur |
| Analytics interne + tableau de bord rentabilité | IMPLEMENTED | Événements first-party, CAC via dépenses saisies |
| Google Analytics / Ads | CONFIGURE | Chargés après consentement si identifiants renseignés |
| Avis clients | IMPLEMENTED | Demande différée (cron), formulaire à jeton, modération ; aucun avis fictif |
| SAV | IMPLEMENTED | Ouverture client, pièces jointes, traitement et statuts côté atelier |
| Tâche quotidienne | CONFIGURE | `/api/cron/daily` protégé par `CRON_SECRET` (planifiée dans `vercel.json`) |
| Rate limiting | PARTIAL | En mémoire (mono-instance) sur connexion, inscription, checkout, suivi, analytics |
| Documents légaux | CONFIGURE | Structures CGV / confidentialité / mentions légales versionnées, contenu à valider juridiquement |
| Multi-atelier, multi-pays, stock de pièces, comptabilité | NOT IMPLEMENTED | Schéma préparé (`workshops`, `technicians`, `repair_parts`), pas d'écran dédié |

## Ce qui a été testé réellement

- `tests/*.test.ts` : moteur de prix, compatibilité, machine à états, numéros, règles métier, uploads, markdown (33 tests).
- `tests/integration/orders.test.ts` (`INTEGRATION=1 npm run test:integration`) : refus des options incompatibles/inactives et des transports inconnus à la création de commande, unicité des numéros de dossier, devis et factures sous concurrence.
- `supabase/tests/rls.test.sql` (`npm run test:db`) : isolation client A / client B, technicien sans droit sur les prix et réglages, storage isolé par dossier, RPC de décision de devis.
- Scénarios navigateur (Playwright, non versionnés) : commande complète PS5 HDMI + option + transport → paiement simulé → REP-XXXXXX → compte créé → dossier ; réception, photos, diagnostic, devis accepté puis payé, devis refusé, réparation, tests, expédition, livraison, clôture par l'admin ; accès directs par URL refusés ; captures mobiles 375/390/430 sans débordement horizontal.

## Corrections issues de l'audit

- Garde d'expédition : les étiquettes PDF (média `SHIPPING`) satisfaisaient la condition « photo de l'état final / du colis fermé » ; seules les images comptent désormais et les étiquettes ne sont plus mélangées aux photos.
- Case « nécessite un paiement » des devis toujours enregistrée à `false` (champ caché) ; corrigé et vérifié en base (devis accepté → paiement → ligne ajoutée).
- Échec de stockage d'une étiquette : l'expédition était enregistrée sans étiquette ; l'erreur est maintenant remontée et l'étiquette annulée chez le transporteur.
- Lien « définir mon mot de passe » inutilisable avec le callback SSR ; passage au flux `token_hash`.
- Débordements horizontaux mobiles (stepper de commande, espace client, onglets du back-office) corrigés.
- Pages modèle sans réparation publiée retirées du sitemap et passées en `noindex`.
