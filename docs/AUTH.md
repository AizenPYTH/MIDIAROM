# Authentification et permissions

- Supabase Auth : e-mail/mot de passe et lien magique (`app/(auth)`), callback `/auth/callback`, réinitialisation de mot de passe.
- Un compte est créé automatiquement au checkout (e-mail de définition du mot de passe) ; un e-mail connu rattache la commande au compte existant.
- Rôles dans `profiles.role` : `CUSTOMER`, `TECHNICIAN`, `ADMIN`, `SUPER_ADMIN`. Attribution depuis Back-office → Techniciens (super admin requis pour nommer un admin). Un trigger empêche l'auto-escalade.
- `proxy.ts` protège `/compte` et `/admin` ; `lib/security/auth.ts` (`requireUser`, `requireStaff`, `requireAdmin`) est appelé dans chaque layout/action sensible.
- RLS : voir `docs/DATABASE.md`. Les écritures métier utilisent le client service-role **après** vérification applicative.
- Rate limiting en mémoire (`lib/security/rate-limit.ts`) sur connexion, inscription, suivi public, checkout, analytics — remplacer le store par Redis pour un déploiement multi-instances.
- Fichiers : validation MIME/taille (`lib/security/upload.ts`) + limites des buckets ; noms générés (UUID) ; URLs signées courtes.
- Suppression de compte : anonymisation des dossiers, suppression des adresses et de l'utilisateur (RGPD).

## Premier administrateur en production

Après inscription sur le site :

```sql
update public.profiles set role = 'SUPER_ADMIN' where email = 'vous@exemple.fr';
```
