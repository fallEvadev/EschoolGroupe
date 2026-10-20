# Plateforme numérique E-School

Plateforme web d'E-School pour automatiser le suivi pédagogique des formateurs, la maintenance du parc informatique, la gestion RH et la diffusion des rapports aux écoles partenaires.

> Spécifications complètes : [CAHIER_DES_CHARGES.md](./CAHIER_DES_CHARGES.md) (v3.0)

**Responsable du projet :** Awa Fall

---

## Fonctionnalités

- **Rôles et accès** : Formateur, Maintenancier, Directeur partenaire, Admin Pédagogie, Admin RH, Admin Maintenance, Super-Admin. Chaque rôle est contrôlé par le proxy Next.js (`src/proxy.ts`), par les Server Actions et par les politiques RLS de Supabase.
- **Gestion RH** : création des recrues (CV, CNI, photo), invitation sécurisée, acceptation du règlement intérieur, désactivation et archivage.
- **Pointage** : codes quotidiens par école, contrôle de la fenêtre horaire et de la géolocalisation (position de l'école enregistrée par son directeur), suivi et décisions de la Direction, programme mensuel en PDF.
- **Rapports journaliers** : saisie hors ligne, validation ou renvoi par la Direction, corrections historisées, notifications.
- **Maintenance** : inventaire des machines par école, tickets de pannes créés à l'envoi des rapports, affectation aux maintenanciers, suivi jusqu'à la résolution, notifications et statistiques.
- **Bilans périodiques** : regroupement hebdomadaire ou mensuel des rapports validés, export Word éditable avec logo et signature, PDF final déposé puis publié, consultation par les directeurs partenaires sur leur portail, avertis par notification et par e-mail.
- **Tableau de bord** : chiffres et graphiques de l'espace admin, adaptés au rôle (pédagogie, RH, maintenance).

## Stack technique

| Couche | Outil |
| --- | --- |
| Framework | Next.js (App Router) |
| Langage | TypeScript (mode strict) |
| Interface | React, Tailwind CSS, shadcn/ui, Lucide |
| Authentification | Clerk |
| Base de données, fichiers, temps réel | Supabase (PostgreSQL, Storage, Realtime, Edge Functions, Cron) |
| Formulaires | React Hook Form + Zod |
| Hors ligne | Dexie (IndexedDB) : copie locale du brouillon de rapport. Pas de PWA ni de service worker |
| Exports | docx (fichier Word des bilans). Le PDF final est déposé par la Direction, il n'est pas généré |
| Emails | Resend (e-mail en HTML simple, sans React Email) |
| Tests | Vitest, Playwright |
| Hébergement | Vercel |

## Prérequis

- Node.js (version LTS) et npm
- [Supabase CLI](https://supabase.com/docs/guides/cli) et Docker (pour la base locale)
- Un compte [Clerk](https://clerk.com) et un compte [Supabase](https://supabase.com)
- Git

## Installation

```bash
# 1. Cloner le dépôt
git clone <url-du-depot>
cd eschool-plateforme

# 2. Installer les dépendances
npm install

# 3. Copier les variables d'environnement
cp .env.example .env.local

# 4. Démarrer Supabase en local
supabase start

# 5. Appliquer les migrations et les données de test
supabase db reset

# 6. Générer les types TypeScript de la base
supabase gen types typescript --local > src/types/database.ts

# 7. Lancer le serveur de développement
npm run dev
```

L'application est disponible sur [http://localhost:3000](http://localhost:3000).

## Variables d'environnement

À renseigner dans `.env.local` (ne jamais committer ce fichier) :

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/connexion
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/activation   # activation après invitation RH
CLERK_WEBHOOK_SIGNING_SECRET=     # webhook /api/webhooks/clerk (serveur uniquement)

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000   # en production : l'adresse réelle (lien d'activation des invitations)

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # serveur uniquement

# Emails (bilans publiés : avertissement des directeurs partenaires)
RESEND_API_KEY=
RESEND_FROM_EMAIL=               # ex. « E-School <bilans@exemple.sn> » (domaine vérifié chez Resend)

# (WhatsApp : aucune clé. Les messages sont des liens « wa.me » pré-remplis, sans API.)

# Suivi des erreurs
SENTRY_DSN=
```

### Synchronisation Clerk → Supabase

Le webhook `/api/webhooks/clerk` tient la table `profiles` à jour : création ou mise à jour du profil quand un compte a un rôle (`user.created`, `user.updated`), archivage quand un compte est supprimé (`user.deleted`, jamais de suppression physique).

Dans le tableau de bord Clerk → **Webhooks** → **Add Endpoint** : URL `https://<domaine>/api/webhooks/clerk`, événements `user.created`, `user.updated`, `user.deleted`. Copier le **Signing Secret** dans `CLERK_WEBHOOK_SIGNING_SECRET`. En local, exposer le port 3000 avec un tunnel (ex. ngrok).

Seules les variables préfixées `NEXT_PUBLIC_` sont exposées au navigateur. La clé `SUPABASE_SERVICE_ROLE_KEY` contourne la RLS : elle ne doit être utilisée que côté serveur.

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run start` | Lancer le build de production |
| `npm run lint` | Vérification ESLint |
| `npm run format` | Formatage Prettier |
| `npm run test` | Tests unitaires (Vitest) |
| `npm run test:e2e` | Tests de parcours (Playwright) : pas encore en place |

## Structure du projet

```
eschool-plateforme/
├── src/
│   ├── app/
│   │   ├── (auth)/              # Connexion, activation du compte
│   │   ├── (formateur)/         # Planning, pointage, rapports, documents
│   │   ├── (maintenance)/       # Tickets et inventaire
│   │   ├── (partenaire)/        # Portail des directeurs partenaires
│   │   ├── (admin)/             # Pédagogie, RH, Maintenance, Super-Admin
│   │   └── api/                 # Routes API et webhooks (Clerk)
│   ├── components/
│   │   ├── ui/                  # Composants shadcn/ui
│   │   └── ...                  # Composants métier
│   ├── lib/
│   │   ├── supabase/            # Clients Supabase (serveur, navigateur)
│   │   ├── validations/         # Schémas Zod
│   │   ├── exports/             # Génération Word et PDF
│   │   └── offline/             # Dexie et synchronisation
│   ├── types/
│   │   └── database.ts          # Types générés par Supabase
│   └── proxy.ts                 # Protection des routes par rôle (Clerk, ex-middleware)
├── supabase/
│   ├── migrations/              # Schéma SQL et politiques RLS
│   ├── functions/               # Edge Functions (codes quotidiens, rappels)
│   └── seed.sql                 # Données de test
├── public/                      # Logo, icônes PWA
├── tests/                       # Tests Playwright
├── CAHIER_DES_CHARGES.md
└── README.md
```

## Rôles

| Rôle | Accès principal |
| --- | --- |
| Formateur | Planning, pointage, rapports journaliers, programme, règlement |
| Maintenancier | Tickets de pannes et historique des machines |
| Directeur partenaire | Codes du jour et bilans de son école (lecture seule) |
| Admin Pédagogie | Codes, validation des rapports, programme, bilans |
| Admin RH | Comptes et documents du personnel |
| Admin Maintenance | Affectation des tickets, parc, statistiques |
| Super-Admin | Tous les modules, gestion des admins, journal d'audit |

Le rôle est stocké dans les métadonnées publiques Clerk (`publicMetadata.role`) et lu par Supabase via le JWT Clerk.

## Feuille de route

Une case cochée signifie « code terminé, vérifié par les tests automatiques et par des tests en base ». **Aucun lot n'a encore été testé de bout en bout dans un navigateur** : ce test réel est la dernière étape, après le déploiement.

- [x] **Lot 1 — Socle** : Next.js, Clerk ↔ Supabase, rôles, RLS, charte. *À confirmer : liaison Clerk ↔ Supabase (jeton de session `user_role`, Third-Party Auth) et déploiement Vercel.*
- [x] **Lot 2 — RH** : invitations et activation (webhook Clerk), fiches du personnel, dossier administratif et contrôle des documents, désactivation et archivage, règlement intérieur versionné.
- [x] **Lot 3 — Pointage** : écoles, créneaux et affectations, codes quotidiens, pointage avec géolocalisation, suivi de la Direction, programme mensuel en PDF. *Décision : pas de QR code.*
- [x] **Lot 4 — Rapports journaliers** : saisie, validation avec corrections historisées, notifications, brouillon hors ligne (Dexie).
- [x] **Lot 5 — Maintenance** : inventaire du parc, tickets créés à l'envoi des rapports, espace du maintenancier, affectation, notifications, statistiques.
- [x] **Lot 6 — Bilans et partenaires** : génération par période, export Word, PDF final publié, portail partenaire, notification et e-mail (Resend).
- [x] **Tableau de bord** de l'espace admin, adapté au rôle, avec graphiques.
- [ ] **Déploiement** sur Vercel et déclaration du webhook Clerk.
- [ ] **Test réel** de bout en bout des lots 3 à 6 (pointage, rapport, validation, ticket, bilan, e-mail).

## Conventions

- **Branches** : `main` (production), `develop` (pré-production), `feature/<nom>` pour chaque fonctionnalité.
- **Commits** : format [Conventional Commits](https://www.conventionalcommits.org/fr/) (`feat:`, `fix:`, `docs:`, `refactor:`…).
- **Base de données** : toute modification passe par une migration dans `supabase/migrations/`, jamais directement dans le tableau de bord.
- **Charte graphique** : Bleu / Blanc / Gris, définie dans les variables de thème Tailwind.

## Licence

Projet propriétaire — © E-School. Tous droits réservés.
