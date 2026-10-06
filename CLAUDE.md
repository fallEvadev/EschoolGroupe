# CLAUDE.md

Ce fichier guide Claude Code lorsqu'il travaille sur ce dépôt.

## Projet

Plateforme numérique E-School Groupe : suivi pédagogique des formateurs (pointage, rapports journaliers), maintenance du parc informatique, gestion RH et diffusion de bilans aux écoles partenaires.

- Spécifications complètes : `CAHIER_DES_CHARGES.md` (v3.0). **Le lire avant toute nouvelle fonctionnalité.**
- Installation et structure : `README.md`.
- Langue de l'interface, des messages d'erreur et des commentaires métier : **français**. Noms de code (variables, fonctions, tables) : **anglais**.

## Stack

Next.js (App Router) · TypeScript strict · React · Tailwind CSS · shadcn/ui · Clerk · Supabase (PostgreSQL, Storage, Realtime, Edge Functions, Cron) · React Hook Form + Zod · Serwist + Dexie · Resend · Vitest · Playwright · Vercel.

Ne pas ajouter de nouvelle dépendance sans le signaler et expliquer pourquoi.

## Commandes

```bash
npm run dev            # serveur de développement
npm run build          # build de production (doit passer avant tout commit)
npm run lint           # ESLint
npm run format         # Prettier
npm run test           # Vitest
npm run test:e2e       # Playwright
supabase start         # base locale (Docker)
supabase db reset      # réapplique migrations + seed
supabase migration new <nom>                                    # nouvelle migration
supabase gen types typescript --local > src/types/database.ts   # après chaque migration
```

Après une modification : lancer `npm run lint` et `npm run build`, et les tests concernés.

## Architecture

- `src/app/(auth|formateur|maintenance|partenaire|admin)/` : un groupe de routes par espace utilisateur.
- `src/app/api/` : routes API et webhooks (Clerk, WhatsApp).
- `src/lib/supabase/` : clients Supabase (`server.ts`, `client.ts`). Toujours passer par ces helpers.
- `src/lib/validations/` : schémas Zod, partagés entre formulaires et Server Actions.
- `src/lib/exports/` : génération Word (docx) et PDF (@react-pdf/renderer).
- `src/lib/offline/` : Dexie et synchronisation des brouillons.
- `src/components/ui/` : composants shadcn/ui (générés, modifier avec parcimonie).
- `supabase/migrations/` : schéma SQL et politiques RLS. `supabase/functions/` : Edge Functions.
- `src/middleware.ts` : protection des routes par rôle via Clerk.

Préférer les Server Components et les Server Actions. Utiliser `"use client"` uniquement pour l'interactivité (formulaires, caméra, géolocalisation, mode hors ligne).

## Rôles et sécurité — règles impératives

Rôles : `formateur`, `maintenancier`, `directeur_partenaire`, `admin_pedagogie`, `admin_rh`, `admin_maintenance`, `super_admin`. Stockés dans `publicMetadata.role` de Clerk et lus par Supabase via le JWT Clerk.

1. **Double contrôle** : toute donnée protégée est filtrée par le middleware/les Server Actions **et** par une politique RLS. Ne jamais compter sur l'interface seule.
2. **RLS activée sur toutes les tables**. Chaque nouvelle table arrive avec ses politiques dans la même migration.
3. **`SUPABASE_SERVICE_ROLE_KEY` uniquement côté serveur** (Server Actions, routes API, Edge Functions). Jamais dans un fichier `"use client"` ni dans une variable `NEXT_PUBLIC_`.
4. **Documents du personnel** (CV, CNI, photos) : bucket privé, accès par URL signées de courte durée, réservé à `admin_rh` et `super_admin`.
5. **Aucune suppression physique** de données métier : utiliser des statuts (`archive`, `inactif`…). Les actions sensibles écrivent dans `audit_log`.
6. **Ne jamais committer** `.env.local` ni de clé réelle.

## Règles métier clés

- **Pointage** : code quotidien par école + fenêtre horaire + géolocalisation (rayon défini par école dans `schools`). Échec horaire → statut `retard` ; hors rayon ou géolocalisation refusée → statut `a_verifier`. Un seul pointage par formateur, école et créneau. Limiter les tentatives de code.
- **Rapport journalier** : lié à un pointage. Statuts `brouillon` → `soumis` → `valide` | `valide_avec_corrections` | `a_modifier` (commentaire obligatoire). Un rapport validé est verrouillé. Chaque correction de la Direction va dans `report_revisions`.
- **Pannes** : chaque panne saisie dans un rapport crée un ticket dans `maintenance_tickets` ; un doublon sur une machine déjà en panne se rattache au ticket ouvert.
- **Bilans** : seuls les rapports validés sont inclus. Export .docx éditable, puis PDF final figé envoyé au portail partenaire.
- **Règlement intérieur** : versionné ; une nouvelle version doit être ré-acceptée (`document_acceptances`).

## Conventions de code

- TypeScript strict, pas de `any`. Utiliser les types générés de `src/types/database.ts`.
- Valider toute entrée utilisateur avec Zod, côté client **et** serveur.
- Composants en PascalCase, fichiers de composants en kebab-case, hooks préfixés `use`.
- Style avec Tailwind uniquement ; couleurs de la charte (Bleu / Blanc / Gris) via les variables de thème, pas de valeurs codées en dur.
- Mobile d'abord : tester à 360 px de large. Penser connexion lente (images compressées, pas de chargements inutiles).
- Dates : `date-fns` avec la locale `fr`, fuseau `Africa/Dakar`, affichage `jj/mm/aaaa`.
- Commits : Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`).
- Branches : `feature/<nom>` depuis `develop`.

## Base de données

- Toute modification du schéma passe par `supabase migration new`, jamais par le tableau de bord Supabase.
- Après chaque migration : `supabase db reset` puis régénérer les types.
- Noms de tables en `snake_case` anglais au pluriel (`daily_reports`, `maintenance_tickets`).

## Avancement

Lot en cours : **Lot 2 — RH** (mettre à jour cette ligne à chaque changement de lot).

- Lot 1 — Socle : terminé côté code (rôles, double contrôle, RLS, paramètres, accès). Reste à confirmer : liaison Clerk ↔ Supabase dans `supabase/config.toml` et déploiement Vercel.
- Lot 2 — RH, fait : invitations, fiches du personnel, note de suivi, dossier administratif (bucket privé), webhook Clerk, désactivation/archivage depuis « Personnel », règlement intérieur versionné (`internal_rules`, `document_acceptances`, acceptation exigée des formateurs et maintenanciers). Contrôle des documents RH (à vérifier, validé, rejeté avec motif) fait : le Lot 2 est terminé côté code, reste à appliquer les migrations sur Supabase et à tester en conditions réelles.

Ordre des lots : 1 Socle → 2 RH → 3 Pointage → 4 Rapports journaliers → 5 Maintenance → 6 Bilans et partenaires. Ne pas implémenter une fonctionnalité d'un lot futur sans demande explicite.
