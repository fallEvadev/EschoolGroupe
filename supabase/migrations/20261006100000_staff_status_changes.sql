-- Lot 2 — RH (étape 3) : désactivation, réactivation et archivage d'une fiche.
-- On garde la trace du dernier changement de statut : motif, date et auteur.
-- Aucune nouvelle politique RLS : `profiles_update` (Admin RH sur les rôles
-- qu'il gère, Super-Admin sur tous) couvre déjà ces colonnes.

alter table public.profiles
  add column status_reason text
    check (status_reason is null or char_length(status_reason) <= 500),
  add column status_changed_at timestamptz,
  add column status_changed_by text;
