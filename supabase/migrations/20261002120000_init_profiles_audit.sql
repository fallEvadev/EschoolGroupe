-- Lot 1 — Socle : rôles, profils et journal d'audit.
-- Le rôle et l'identifiant viennent du jeton Clerk (claims `user_role` et `sub`).

-- ---------------------------------------------------------------------------
-- Rôles
-- ---------------------------------------------------------------------------
create type public.user_role as enum (
  'formateur',
  'maintenancier',
  'directeur_partenaire',
  'admin_pedagogie',
  'admin_rh',
  'admin_maintenance',
  'super_admin'
);

-- Identifiant Clerk de l'utilisateur connecté (claim `sub`).
create or replace function public.current_clerk_id()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '')
$$;

-- Rôle de l'utilisateur connecté (claim `user_role`), en texte.
create or replace function public.current_user_role()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'user_role', '')
$$;

-- Mise à jour automatique de `updated_at`.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles : un profil par utilisateur Clerk
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  email text not null,
  full_name text not null,
  role public.user_role not null,
  -- Aucune suppression physique : on change le statut.
  status text not null default 'actif'
    check (status in ('actif', 'inactif', 'archive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Chacun voit son profil ; l'Admin RH et le Super-Admin voient tout.
create policy "profiles_select"
  on public.profiles for select to authenticated
  using (
    clerk_user_id = public.current_clerk_id()
    or public.current_user_role() in ('admin_rh', 'super_admin')
  );

-- Création et modification : Admin RH et Super-Admin uniquement.
-- Seul le Super-Admin peut toucher à un profil Super-Admin.
create policy "profiles_insert"
  on public.profiles for insert to authenticated
  with check (
    public.current_user_role() = 'super_admin'
    or (public.current_user_role() = 'admin_rh' and role <> 'super_admin')
  );

create policy "profiles_update"
  on public.profiles for update to authenticated
  using (
    public.current_user_role() = 'super_admin'
    or (public.current_user_role() = 'admin_rh' and role <> 'super_admin')
  )
  with check (
    public.current_user_role() = 'super_admin'
    or (public.current_user_role() = 'admin_rh' and role <> 'super_admin')
  );

-- Pas de suppression physique, et rien pour les visiteurs anonymes.
revoke all on public.profiles from anon;
revoke delete, truncate on public.profiles from authenticated;

-- ---------------------------------------------------------------------------
-- audit_log : journal des actions sensibles (lecture Super-Admin)
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_clerk_id text,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;

create policy "audit_log_select"
  on public.audit_log for select to authenticated
  using (public.current_user_role() = 'super_admin');

-- Chacun peut écrire une ligne à son propre nom, jamais au nom d'un autre.
create policy "audit_log_insert"
  on public.audit_log for insert to authenticated
  with check (actor_clerk_id = public.current_clerk_id());

-- Journal en ajout seul : ni modification ni suppression.
revoke all on public.audit_log from anon;
revoke update, delete, truncate on public.audit_log from authenticated;
