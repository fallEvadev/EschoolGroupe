-- Lot 3 — Pointage (étape 1) : écoles, directeurs, créneaux et affectations.
-- Aucune suppression physique : on archive. RLS sur chaque table, dans cette
-- même migration.

-- ---------------------------------------------------------------------------
-- Aides pour les politiques
-- ---------------------------------------------------------------------------

-- Identifiant de la fiche (`profiles.id`) de l'utilisateur connecté.
create or replace function public.current_profile_id()
returns uuid
language sql
stable
as $$
  select id from public.profiles
  where clerk_user_id = public.current_clerk_id()
$$;

-- Vrai pour la Direction pédagogique et le Super-Admin.
create or replace function public.is_pedagogy_manager()
returns boolean
language sql
stable
as $$
  select coalesce(
    public.current_user_role() in ('admin_pedagogie', 'super_admin'),
    false
  )
$$;

-- Annuaire minimal pour la Direction pédagogique : nom, rôle et statut des
-- formateurs et des directeurs partenaires. La RLS de `profiles` ne lui permet
-- pas de lire ces fiches (e-mail, téléphone, documents sont réservés aux RH) ;
-- cette fonction n'expose que ce qu'il faut pour affecter et rattacher.
create or replace function public.pedagogy_staff_directory()
returns table (
  id uuid,
  full_name text,
  role public.user_role,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.role, p.status
  from public.profiles p
  where public.is_pedagogy_manager()
    and p.role in ('formateur', 'directeur_partenaire')
$$;

revoke all on function public.pedagogy_staff_directory() from public, anon;
grant execute on function public.pedagogy_staff_directory() to authenticated;

-- ---------------------------------------------------------------------------
-- schools : une école partenaire
-- ---------------------------------------------------------------------------
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  address text check (address is null or char_length(address) <= 250),
  -- Position de l'école, pour contrôler la géolocalisation au pointage.
  -- Vide tant que la Direction ne l'a pas renseignée.
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  -- Distance maximale (mètres) entre le formateur et l'école.
  radius_m integer not null default 150 check (radius_m between 20 and 5000),
  -- Minutes de grâce après l'heure de début avant le statut « retard ».
  late_tolerance_minutes integer not null default 15
    check (late_tolerance_minutes between 0 and 180),
  status text not null default 'actif' check (status in ('actif', 'archive')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null) = (longitude is null))
);

-- Un nom d'école actif ne peut pas être pris deux fois.
create unique index schools_active_name_unique
  on public.schools (lower(name)) where status = 'actif';

create trigger schools_set_updated_at
  before update on public.schools
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- school_directors : directeurs partenaires rattachés à une école
-- ---------------------------------------------------------------------------
create table public.school_directors (
  school_id uuid not null references public.schools (id),
  profile_id uuid not null references public.profiles (id),
  status text not null default 'actif' check (status in ('actif', 'archive')),
  created_at timestamptz not null default now(),
  primary key (school_id, profile_id)
);

create index school_directors_profile_idx
  on public.school_directors (profile_id) where status = 'actif';

-- ---------------------------------------------------------------------------
-- time_slots : créneaux hebdomadaires d'une école
-- ---------------------------------------------------------------------------
create table public.time_slots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  -- 1 = lundi … 7 = dimanche (norme ISO).
  weekday smallint not null check (weekday between 1 and 7),
  starts_at time not null,
  ends_at time not null,
  label text check (label is null or char_length(label) <= 60),
  status text not null default 'actif' check (status in ('actif', 'archive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index time_slots_school_idx
  on public.time_slots (school_id, weekday) where status = 'actif';

create trigger time_slots_set_updated_at
  before update on public.time_slots
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- slot_assignments : formateur affecté à un créneau
-- ---------------------------------------------------------------------------
create table public.slot_assignments (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.time_slots (id),
  profile_id uuid not null references public.profiles (id),
  status text not null default 'actif' check (status in ('actif', 'archive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un formateur n'est affecté qu'une fois, tant que l'affectation est active.
create unique index slot_assignments_active_unique
  on public.slot_assignments (slot_id, profile_id) where status = 'actif';

create index slot_assignments_profile_idx
  on public.slot_assignments (profile_id) where status = 'actif';

create trigger slot_assignments_set_updated_at
  before update on public.slot_assignments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Garde-fous d'intégrité : seul un formateur est affecté à un créneau, seul un
-- directeur partenaire est rattaché à une école (même si l'application se
-- trompe).
-- ---------------------------------------------------------------------------
create or replace function public.require_formateur_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = new.profile_id and role = 'formateur'
  ) then
    raise exception 'Seul un formateur peut être affecté à un créneau.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger slot_assignments_require_formateur
  before insert or update of profile_id on public.slot_assignments
  for each row execute function public.require_formateur_profile();

create or replace function public.require_director_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = new.profile_id and role = 'directeur_partenaire'
  ) then
    raise exception 'Seul un directeur partenaire peut être rattaché à une école.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger school_directors_require_director
  before insert or update of profile_id on public.school_directors
  for each row execute function public.require_director_profile();

-- ---------------------------------------------------------------------------
-- RLS : lecture selon le rôle, écriture réservée à la Direction pédagogique
-- ---------------------------------------------------------------------------
alter table public.schools enable row level security;
alter table public.school_directors enable row level security;
alter table public.time_slots enable row level security;
alter table public.slot_assignments enable row level security;

-- schools : la Direction, les directeurs de l'école, les formateurs qui y
-- ont un créneau.
create policy "schools_select"
  on public.schools for select to authenticated
  using (
    public.is_pedagogy_manager()
    or exists (
      select 1 from public.school_directors d
      where d.school_id = schools.id
        and d.status = 'actif'
        and d.profile_id = public.current_profile_id()
    )
    or exists (
      select 1
      from public.time_slots t
      join public.slot_assignments a on a.slot_id = t.id
      where t.school_id = schools.id
        and t.status = 'actif'
        and a.status = 'actif'
        and a.profile_id = public.current_profile_id()
    )
  );

create policy "schools_insert"
  on public.schools for insert to authenticated
  with check (public.is_pedagogy_manager());

create policy "schools_update"
  on public.schools for update to authenticated
  using (public.is_pedagogy_manager())
  with check (public.is_pedagogy_manager());

-- school_directors : la Direction, et chaque directeur pour ses propres lignes.
create policy "school_directors_select"
  on public.school_directors for select to authenticated
  using (
    public.is_pedagogy_manager()
    or profile_id = public.current_profile_id()
  );

create policy "school_directors_insert"
  on public.school_directors for insert to authenticated
  with check (public.is_pedagogy_manager());

create policy "school_directors_update"
  on public.school_directors for update to authenticated
  using (public.is_pedagogy_manager())
  with check (public.is_pedagogy_manager());

-- time_slots : la Direction, les directeurs de l'école, les formateurs affectés.
create policy "time_slots_select"
  on public.time_slots for select to authenticated
  using (
    public.is_pedagogy_manager()
    or exists (
      select 1 from public.school_directors d
      where d.school_id = time_slots.school_id
        and d.status = 'actif'
        and d.profile_id = public.current_profile_id()
    )
    or exists (
      select 1 from public.slot_assignments a
      where a.slot_id = time_slots.id
        and a.status = 'actif'
        and a.profile_id = public.current_profile_id()
    )
  );

create policy "time_slots_insert"
  on public.time_slots for insert to authenticated
  with check (public.is_pedagogy_manager());

create policy "time_slots_update"
  on public.time_slots for update to authenticated
  using (public.is_pedagogy_manager())
  with check (public.is_pedagogy_manager());

-- slot_assignments : la Direction, et chaque formateur pour ses affectations.
create policy "slot_assignments_select"
  on public.slot_assignments for select to authenticated
  using (
    public.is_pedagogy_manager()
    or profile_id = public.current_profile_id()
  );

create policy "slot_assignments_insert"
  on public.slot_assignments for insert to authenticated
  with check (public.is_pedagogy_manager());

create policy "slot_assignments_update"
  on public.slot_assignments for update to authenticated
  using (public.is_pedagogy_manager())
  with check (public.is_pedagogy_manager());

-- Pas de suppression physique, et rien pour les visiteurs anonymes.
revoke all on
  public.schools,
  public.school_directors,
  public.time_slots,
  public.slot_assignments
from anon;
revoke delete, truncate on
  public.schools,
  public.school_directors,
  public.time_slots,
  public.slot_assignments
from authenticated;
