# Plateforme numérique E-School Groupe

Plateforme web d'E-School Groupe pour automatiser le suivi pédagogique des formateurs, la maintenance du parc informatique, la gestion RH et la diffusion des rapports aux écoles partenaires.

> Spécifications complètes : [CAHIER_DES_CHARGES.md](./CAHIER_DES_CHARGES.md) (v3.0)

**Responsable du projet :** Awa Fall

---

## Fonctionnalités

- **Rôles et accès** : Formateur, Maintenancier, Directeur partenaire, Admin Pédagogie, Admin RH, Admin Maintenance, Super-Admin. Chaque rôle est contrôlé par le middleware Next.js et par les politiques RLS de Supabase.
- **Gestion RH** : création des recrues (CV, CNI, photo), invitation sécurisée, acceptation du règlement intérieur, désactivation et archivage.
- **Pointage** : codes quotidiens par école, QR code, contrôle de la fenêtre horaire et de la géolocalisation.
- **Rapports journaliers** : saisie hors ligne, validation ou renvoi par la Direction, corrections historisées, notifications.
- **Maintenance** : inventaire des machines, tickets de pannes créés depuis les rapports, suivi jusqu'à la résolution.
- **Bilans périodiques** : regroupement hebdomadaire ou mensuel, export Word et PDF avec logo et signature, envoi aux écoles partenaires.

## Stack technique

| Couche | Outil |
| --- | --- |
| Framework | Next.js (App Router) |
| Langage | TypeScript (mode strict) |
| Interface | React, Tailwind CSS, shadcn/ui, Lucide |
| Authentification | Clerk |
| Base de données, fichiers, temps réel | Supabase (PostgreSQL, Storage, Realtime, Edge Functions, Cron) |
| Formulaires | React Hook Form + Zod |
| Hors ligne | Serwist (PWA) + Dexie (IndexedDB) |
| Exports | docx, @react-pdf/renderer |
| Emails | Resend + React Email |
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

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # serveur uniquement

# Emails
RESEND_API_KEY=

# WhatsApp / SMS (lot 6)
WHATSAPP_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=

# Suivi des erreurs
SENTRY_DSN=
```

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
| `npm run test:e2e` | Tests de parcours (Playwright) |

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
│   │   └── api/                 # Routes API et webhooks (Clerk, WhatsApp)
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
│   └── middleware.ts            # Protection des routes par rôle (Clerk)
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

- [ ] **Lot 1 — Socle** : Next.js, Clerk ↔ Supabase, rôles, RLS, charte, déploiement Vercel
- [ ] **Lot 2 — RH** : recrues, invitations, activation, archivage
- [ ] **Lot 3 — Pointage** : écoles, planning, codes quotidiens, QR, géolocalisation
- [ ] **Lot 4 — Rapports journaliers** : formulaire hors ligne, validation, notifications
- [ ] **Lot 5 — Maintenance** : inventaire, tickets, statistiques
- [ ] **Lot 6 — Bilans et partenaires** : exports Word/PDF, signature, portail et envois

## Conventions

- **Branches** : `main` (production), `develop` (pré-production), `feature/<nom>` pour chaque fonctionnalité.
- **Commits** : format [Conventional Commits](https://www.conventionalcommits.org/fr/) (`feat:`, `fix:`, `docs:`, `refactor:`…).
- **Base de données** : toute modification passe par une migration dans `supabase/migrations/`, jamais directement dans le tableau de bord.
- **Charte graphique** : Bleu / Blanc / Gris, définie dans les variables de thème Tailwind.

## Licence

Projet propriétaire — © E-School Groupe. Tous droits réservés.
