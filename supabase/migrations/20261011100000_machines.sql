-- Lot 5 — Maintenance (étape 5.1) : inventaire du parc informatique.
-- Une machine appartient à une école. Aucune suppression physique : on archive.
-- RLS dans cette même migration. Les tickets de pannes viennent en 5.3.

-- ---------------------------------------------------------------------------
-- Aides pour les politiques
-- ---------------------------------------------------------------------------

-- Vrai pour l'Admin Maintenance et le Super-Admin : ils tiennent l'inventaire.
create or replace function public.is_maintenance_manager()
returns boolean
language sql
stable
as $$
  select coalesce(
    public.current_user_role() in ('admin_maintenance', 'super_admin'),
    false
  )
$$;

-- Vrai pour ceux qui consultent le parc : maintenanciers et leurs responsables.
create or replace function public.is_maintenance_staff()
returns boolean
language sql
stable
as $$
  select coalesce(
    public.current_user_role() in (
      'maintenancier', 'admin_maintenance', 'super_admin'
    ),
    false
  )
$$;

-- Liste minimale des écoles (identifiant, nom, statut) pour la maintenance.
-- La RLS de `schools` ne leur ouvre pas la table (adresse, position GPS, etc.) :
-- cette fonction n'expose que ce qu'il faut pour rattacher une machine à une école.
create or replace function public.maintenance_schools()
returns table (
  id uuid,
  name text,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.name, s.status
  from public.schools s
  where public.is_maintenance_staff()
$$;

revoke all on function public.maintenance_schools() from public, anon;
grant execute on function public.maintenance_schools() to authenticated;

-- ---------------------------------------------------------------------------
-- machines : un équipement du parc d'une école
-- ---------------------------------------------------------------------------
create table public.machines (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  -- Nom tel que le formateur le reconnaît : « PC 4 », « Vidéoprojecteur ».
  label text not null check (char_length(label) between 1 and 60),
  kind text not null default 'ordinateur'
    check (kind in (
      'ordinateur', 'videoprojecteur', 'imprimante', 'reseau', 'autre'
    )),
  serial_number text
    check (serial_number is null or char_length(serial_number) <= 80),
  status text not null default 'actif' check (status in ('actif', 'archive')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Deux machines actives d'une même école ne portent pas le même nom
-- (« PC 4 » et « pc 4 » comptent pour un doublon).
create unique index machines_active_label_unique
  on public.machines (school_id, lower(label)) where status = 'actif';

create index machines_school_idx
  on public.machines (school_id) where status = 'actif';

create trigger machines_set_updated_at
  before update on public.machines
  for each row execute function public.set_updated_at();

-- Une machine ne change pas d'école : les tickets passés lui sont rattachés.
create or replace function public.machines_keep_school()
returns trigger
language plpgsql
as $$
begin
  if new.school_id is distinct from old.school_id then
    raise exception 'Une machine ne peut pas changer d''école.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger machines_keep_school
  before update on public.machines
  for each row execute function public.machines_keep_school();

-- ---------------------------------------------------------------------------
-- RLS : lecture selon le rôle, écriture réservée à la gestion de la maintenance
-- ---------------------------------------------------------------------------
alter table public.machines enable row level security;

-- Lecture : la maintenance, la Direction pédagogique, et les formateurs qui ont
-- un créneau actif dans l'école (pour choisir la machine en panne).
create policy "machines_select"
  on public.machines for select to authenticated
  using (
    public.is_maintenance_staff()
    or public.is_pedagogy_manager()
    or exists (
      select 1
      from public.time_slots t
      join public.slot_assignments a on a.slot_id = t.id
      where t.school_id = machines.school_id
        and t.status = 'actif'
        and a.status = 'actif'
        and a.profile_id = public.current_profile_id()
    )
  );

create policy "machines_insert"
  on public.machines for insert to authenticated
  with check (public.is_maintenance_manager());

create policy "machines_update"
  on public.machines for update to authenticated
  using (public.is_maintenance_manager())
  with check (public.is_maintenance_manager());

-- Pas de suppression physique, et rien pour les visiteurs anonymes.
revoke all on public.machines from anon;
revoke delete, truncate on public.machines from authenticated;
