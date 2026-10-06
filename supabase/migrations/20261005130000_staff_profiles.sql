-- Lot 2 — RH (étape 1) : fiches du personnel, invitations et note de suivi.

-- ---------------------------------------------------------------------------
-- profiles : informations RH et recrues invitées
-- ---------------------------------------------------------------------------

-- Une recrue invitée n'a pas encore de compte Clerk : l'identifiant est
-- renseigné par le webhook quand elle active son compte.
alter table public.profiles alter column clerk_user_id drop not null;

alter table public.profiles
  add column phone text,
  add column job_title text,
  add column contract_type text
    check (contract_type in ('cdi', 'cdd', 'vacataire', 'stage', 'prestataire')),
  add column hire_date date,
  add column invitation_id text,
  add column invited_at timestamptz,
  add column created_by text;

-- Nouveau statut « invite » : fiche créée, compte pas encore activé.
alter table public.profiles drop constraint profiles_status_check;
alter table public.profiles
  add constraint profiles_status_check
  check (status in ('invite', 'actif', 'inactif', 'archive'));

-- Une adresse e-mail = une seule fiche (sans tenir compte des majuscules).
create unique index profiles_email_unique on public.profiles (lower(email));

-- Rôles qu'un Admin RH peut attribuer. Les comptes administrateurs restent
-- gérés par le Super-Admin.
create or replace function public.is_rh_manageable_role(value public.user_role)
returns boolean
language sql
immutable
as $$
  select value in ('formateur', 'maintenancier', 'directeur_partenaire')
$$;

drop policy "profiles_insert" on public.profiles;
create policy "profiles_insert"
  on public.profiles for insert to authenticated
  with check (
    public.current_user_role() = 'super_admin'
    or (
      public.current_user_role() = 'admin_rh'
      and public.is_rh_manageable_role(role)
    )
  );

drop policy "profiles_update" on public.profiles;
create policy "profiles_update"
  on public.profiles for update to authenticated
  using (
    public.current_user_role() = 'super_admin'
    or (
      public.current_user_role() = 'admin_rh'
      and public.is_rh_manageable_role(role)
    )
  )
  with check (
    public.current_user_role() = 'super_admin'
    or (
      public.current_user_role() = 'admin_rh'
      and public.is_rh_manageable_role(role)
    )
  );

-- ---------------------------------------------------------------------------
-- staff_notes : note de suivi, visible par la direction uniquement
-- (table séparée : la personne peut lire sa fiche, jamais cette note)
-- ---------------------------------------------------------------------------
create table public.staff_notes (
  profile_id uuid primary key references public.profiles (id),
  content text not null default '' check (char_length(content) <= 5000),
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger staff_notes_set_updated_at
  before update on public.staff_notes
  for each row execute function public.set_updated_at();

alter table public.staff_notes enable row level security;

create policy "staff_notes_select"
  on public.staff_notes for select to authenticated
  using (public.current_user_role() in ('admin_rh', 'super_admin'));

create policy "staff_notes_insert"
  on public.staff_notes for insert to authenticated
  with check (public.current_user_role() in ('admin_rh', 'super_admin'));

create policy "staff_notes_update"
  on public.staff_notes for update to authenticated
  using (public.current_user_role() in ('admin_rh', 'super_admin'))
  with check (public.current_user_role() in ('admin_rh', 'super_admin'));

-- Pas de suppression physique, et rien pour les visiteurs anonymes.
revoke all on public.staff_notes from anon;
revoke delete, truncate on public.staff_notes from authenticated;
