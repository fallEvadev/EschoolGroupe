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

Lot en cours : **Lot 4 — Rapports journaliers** (mettre à jour cette ligne à chaque changement de lot).

- Lot 4 — Rapports journaliers, découpage : 4.1 saisie par le formateur · 4.2 validation par la Direction (corrections, `report_revisions`) · 4.3 notifications (badge rafraîchi chaque minute) · 4.4 brouillon hors ligne (Dexie, nouvelle dépendance à valider). Décisions : classes en texte libre, pannes enregistrées avec le rapport (tickets au Lot 5).
- 4.1 : terminée côté code, migration `20261008100000_daily_reports.sql` appliquée (`daily_reports`, `report_revisions`, fonction `submit_daily_report`). Un rapport par pointage ; un rapport validé est verrouillé par un déclencheur SQL ; le formateur ne modifie que brouillon ou « à modifier ». Pages `/formateur/cahiers` (liste des 30 derniers jours) et `/formateur/cahiers/[pointage]` (formulaire : classes, thème, matériel, pannes). Écriture avec le jeton du formateur (RLS), jamais la clé de service.
- 4.2 : terminée côté code, migration `20261008110000_review_daily_report.sql` (fonction `review_daily_report`, politique de mise à jour pour la Direction, déclencheur resserré). Page `/admin/rapports` (Admin Pédagogie et Super-Admin) : rapports à traiter et dernières décisions ; valider, corriger et valider, ou demander une modification (commentaire obligatoire). Chaque décision s'ajoute à `report_revisions` (la version envoyée par le formateur est conservée) ; le journal d'audit ne contient ni commentaire ni contenu.
- 4.3 : code écrit et vérifié (lint, tests, build) — migration `20261008120000_notifications.sql` à appliquer sur Supabase. Table `notifications` : créée uniquement par deux déclencheurs SQL — (1) la Direction décide d'un rapport (validé / validé avec corrections / à modifier) : le formateur est notifié ; (2) un formateur envoie ou renvoie un rapport : chaque Admin Pédagogie et Super-Admin actif est notifié. Chacun lit les siennes et ne peut que les marquer comme lues (droit limité à la colonne `read_at`) ; le texte ne reprend ni le commentaire ni le contenu du rapport. Cloche avec badge dans l'en-tête de l'espace formateur et de l'espace admin (Direction pédagogique seulement) : compteur initial côté serveur, rafraîchi chaque minute et au retour sur l'onglet, aucune requête onglet caché. Pages `/formateur/notifications` et `/admin/notifications` (« Tout marquer comme lu »). Actions partagées dans `src/lib/notification-actions.ts`.
- 4.4 : code écrit et vérifié (lint, tests, build), dépendance **Dexie** validée par Awa, aucune migration. Le formulaire du rapport copie la saisie dans le navigateur (IndexedDB, base `eschool-offline`, table `report_drafts`, clé = pointage) après 0,8 s sans frappe, liée au compte Clerk ; brouillons expirés (14 jours) ou d'un autre compte purgés au chargement. Au retour sur la page, un brouillon local différent du serveur est proposé (« Reprendre » / « Ignorer »). Hors ligne ou coupure en cours d'envoi : la saisie est gardée, message clair, et **aucun envoi automatique** (décision : le formateur relit puis envoie). Copie locale effacée après un enregistrement ou un envoi réussi. Logique pure dans `src/lib/offline/report-drafts.ts` (testée), accès Dexie dans `db.ts` et `report-drafts-store.ts` (échecs silencieux si IndexedDB indisponible). Pas de Serwist : ouvrir la page sans réseau reste hors périmètre.

- Lot 3 — Pointage, découpage : 3.1 écoles, directeurs, créneaux, affectations · 3.2 codes quotidiens · 3.3 pointage du formateur · 3.4 transmission aux directeurs (lien WhatsApp pré-rempli) · 3.5 suivi de la Direction · programme mensuel en PDF (petite étape à part). Décisions : pas de QR code, règlement publié par Admin RH + Super-Admin seulement.
- 3.1 : terminée, migration `20261006140000_schools_slots.sql` appliquée. Page `/admin/ecoles` réservée à l'Admin Pédagogie et au Super-Admin.
- 3.2 : terminée, migration `20261007100000_daily_codes.sql` appliquée. Page `/admin/codes` : génération manuelle des codes du jour (6 chiffres, un par école, jamais deux écoles avec le même code), régénération atomique (`replace_daily_code`), codes jamais écrits dans l'audit.
- 3.3 : terminée, migration `20261007110000_attendances.sql` appliquée. Pointage formateur (`/formateur/pointage`) et planning (`/formateur/planning`). Règles : fenêtre de 30 min avant le début jusqu'à la fin du créneau, retard après début + tolérance de l'école, hors rayon / GPS refusé / imprécis / école sans position → `a_verifier`, 5 codes faux → blocage 15 min, un pointage par formateur, créneau et jour. Le serveur écrit avec la clé de service (la base interdit toute écriture directe) ; seules la distance et la précision sont conservées, jamais les coordonnées.
- 3.4 : terminée, migration `20261007120000_directory_phone.sql` appliquée (l'annuaire minimal de la Direction pédagogique renvoie aussi le téléphone des directeurs, jamais celui des formateurs). Espace partenaire (`/partenaire`) : code du jour de ses écoles, bouton Copier et partage WhatsApp pour les formateurs. Page `/admin/codes` : bouton WhatsApp par directeur rattaché (lien `wa.me` pré-rempli, aucune API ni dépendance).
- 3.5 : code écrit et vérifié (lint, tests, build) — migration `20261007130000_attendance_follow_up.sql` à appliquer sur Supabase. Page `/admin/pointages` (Admin Pédagogie et Super-Admin) : vue Jour (compteurs, filtres école / formateur / statut) et vue Mois par formateur. Valider ou refuser un pointage « à vérifier » (refus = motif obligatoire, compte comme une absence), excuser une absence avec un motif, marquer un jour « sans cours ». Le pointage d'origine n'est jamais modifié : les décisions sont dans `attendance_reviews`, `absence_excuses` et `closed_days`, écrites avec le jeton de la Direction (RLS). Les absences se reconstruisent à n'importe quelle date depuis les créneaux (jamais modifiés, seulement archivés). Le formateur voit la décision sur son accueil. 3.5 terminée côté code.
- Programme mensuel : code écrit et vérifié (lint, tests, build) — migration `20261007140000_monthly_programs.sql` à appliquer sur Supabase. Page `/admin/programmes` (Admin Pédagogie et Super-Admin) : un PDF (10 Mo max) par mois, pour toute la plateforme ; un nouveau PDF pour le même mois remplace l'ancien, conservé (`replace_monthly_program`, une transaction). Bucket privé `monthly-programs`, envoi direct par lien signé, puis le serveur lit les 5 premiers octets et refuse tout fichier qui ne commence pas par `%PDF-`. Les formateurs lisent seulement la version en vigueur (RLS table et stockage), depuis `/formateur/documents` et une carte sur leur accueil. Après publication : bouton WhatsApp pré-rempli pour prévenir le groupe. Le Lot 3 est terminé côté code.
- Position de l'école (changement de conception, migration `20261007160000_school_position_and_attendance_coordinates.sql` à appliquer) : l'administrateur ne saisit plus latitude, longitude ni rayon à la création d'une école (le rayon reste fixé à 150 m, colonne `radius_m` conservée). Le directeur partenaire enregistre la position de SON école une fois, sur place, depuis `/partenaire` (fonction SQL `set_school_position`, qui ne lui ouvre que la position ; précision ≤ 100 m, déplacement tracé dans l'audit). Saisie manuelle de secours repliée sur la fiche d'école (Direction pédagogique). Un pointage conserve désormais les coordonnées GPS du formateur (`attendances.latitude/longitude`, lisibles par lui et la Direction seulement). Bouton « 📍 Je suis arrivé à l'école », message « Pointage enregistré avec succès. », et choix « Réessayer » / « Pointer quand même » si la localisation échoue. Le code du jour reste obligatoire.
- Revue de sécurité du Lot 3 (corrections, migration `20261007150000_atomic_attendance_code_check.sql` à appliquer) : la limite de 5 codes faux / 15 min est désormais appliquée par la fonction SQL `verify_attendance_code` (verrou par formateur, contrôle du code et enregistrement de l'échec dans une seule transaction, appelable par la clé de service seulement). Une erreur de contrôle REFUSE le pointage (jamais « on laisse passer »). Les motifs d'excuse et les commentaires de décision ne sont plus copiés dans `audit_log`. `lockState` (TypeScript) n'est plus appelée : elle reste comme spécification testée de la règle SQL, et les valeurs 5 / 15 min doivent changer ensemble dans `attendance.ts` et dans la fonction SQL.

- Lot 1 — Socle : terminé côté code (rôles, double contrôle, RLS, paramètres, accès). Reste à confirmer : liaison Clerk ↔ Supabase dans `supabase/config.toml` et déploiement Vercel.
- Lot 2 — RH, fait : invitations, fiches du personnel, note de suivi, dossier administratif (bucket privé), webhook Clerk, désactivation/archivage depuis « Personnel », règlement intérieur versionné (`internal_rules`, `document_acceptances`, acceptation exigée des formateurs et maintenanciers). Contrôle des documents RH (à vérifier, validé, rejeté avec motif) fait : le Lot 2 est terminé côté code, reste à appliquer les migrations sur Supabase et à tester en conditions réelles.

Ordre des lots : 1 Socle → 2 RH → 3 Pointage → 4 Rapports journaliers → 5 Maintenance → 6 Bilans et partenaires. Ne pas implémenter une fonctionnalité d'un lot futur sans demande explicite.
