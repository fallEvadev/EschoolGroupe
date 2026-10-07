-- Lot 3 — Pointage (étape 5) : suivi des pointages par la Direction.
--
-- Trois tables, toutes écrites par la Direction pédagogique avec SON jeton
-- (la RLS vérifie son rôle : double contrôle, sans clé de service) :
--   - attendance_reviews : décision sur un pointage « à vérifier » ;
--   - closed_days        : jours sans cours (fériés, vacances) ;
--   - absence_excuses    : absences excusées avec un motif.
-- Le pointage d'origine (attendances) n'est jamais modifié : c'est la preuve
-- brute. Les décisions s'y ajoutent.

-- ---------------------------------------------------------------------------
-- attendance_reviews : décision sur un pointage « à vérifier »
-- ---------------------------------------------------------------------------
create table public.attendance_reviews (
  id uuid primary key default gen_random_uuid(),
  -- Une seule décision par pointage (modifiable : l'audit garde l'historique).
  attendance_id uuid not null unique references public.attendances (id),
  decision text not null check (decision in ('valide', 'refuse')),
  comment text check (comment is null or char_length(comment) <= 500),
  reviewed_by text not null,
  reviewed_at timestamptz not null default now(),
  -- Un refus doit être expliqué : le formateur lit ce motif.
  check (
    decision <> 'refuse'
    or (comment is not null and char_length(btrim(comment)) >= 3)
  )
);

-- Seul un pointage « à vérifier » peut être traité, même si l'application se
-- trompe.
create or replace function public.require_reviewable_attendance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.attendances
    where id = new.attendance_id and status = 'a_verifier'
  ) then
    raise exception 'Seul un pointage à vérifier peut être traité.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger attendance_reviews_require_reviewable
  before insert or update of attendance_id on public.attendance_reviews
  for each row execute function public.require_reviewable_attendance();

alter table public.attendance_reviews enable row level security;

-- Lecture : la Direction, et le formateur concerné (il lit la décision).
create policy "attendance_reviews_select"
  on public.attendance_reviews for select to authenticated
  using (
    public.is_pedagogy_manager()
    or attendance_id in (
      select id from public.attendances
      where profile_id = public.current_profile_id()
    )
  );

create policy "attendance_reviews_insert"
  on public.attendance_reviews for insert to authenticated
  with check (
    public.is_pedagogy_manager()
    and reviewed_by = public.current_clerk_id()
  );

create policy "attendance_reviews_update"
  on public.attendance_reviews for update to authenticated
  using (public.is_pedagogy_manager())
  with check (
    public.is_pedagogy_manager()
    and reviewed_by = public.current_clerk_id()
  );

revoke all on public.attendance_reviews from anon;
revoke delete, truncate on public.attendance_reviews from authenticated;

-- ---------------------------------------------------------------------------
-- closed_days : jours sans cours (aucune absence n'est calculée ce jour-là)
-- ---------------------------------------------------------------------------
create table public.closed_days (
  id uuid primary key default gen_random_uuid(),
  closed_date date not null,
  -- Vide : toutes les écoles. Renseigné : cette école seulement.
  school_id uuid references public.schools (id),
  reason text not null check (char_length(btrim(reason)) between 3 and 200),
  -- Aucune suppression : « archive » rouvre le jour.
  status text not null default 'actif' check (status in ('actif', 'archive')),
  created_by text not null,
  created_at timestamptz not null default now()
);

-- Un jour n'est fermé qu'une fois pour une même portée (toutes les écoles, ou
-- une école donnée).
create unique index closed_days_active_unique
  on public.closed_days (
    closed_date,
    coalesce(school_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status = 'actif';

create index closed_days_date_idx on public.closed_days (closed_date);

alter table public.closed_days enable row level security;

create policy "closed_days_select"
  on public.closed_days for select to authenticated
  using (public.is_pedagogy_manager());

create policy "closed_days_insert"
  on public.closed_days for insert to authenticated
  with check (
    public.is_pedagogy_manager()
    and created_by = public.current_clerk_id()
  );

create policy "closed_days_update"
  on public.closed_days for update to authenticated
  using (public.is_pedagogy_manager())
  with check (public.is_pedagogy_manager());

revoke all on public.closed_days from anon;
revoke delete, truncate on public.closed_days from authenticated;

-- ---------------------------------------------------------------------------
-- absence_excuses : absence excusée avec un motif
-- ---------------------------------------------------------------------------
create table public.absence_excuses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id),
  slot_id uuid not null references public.time_slots (id),
  absence_date date not null,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  -- Aucune suppression : « archive » annule l'excuse.
  status text not null default 'actif' check (status in ('actif', 'archive')),
  created_by text not null,
  created_at timestamptz not null default now()
);

-- Une seule excuse active par formateur, créneau et jour.
create unique index absence_excuses_active_unique
  on public.absence_excuses (profile_id, slot_id, absence_date)
  where status = 'actif';

create index absence_excuses_date_idx on public.absence_excuses (absence_date);

alter table public.absence_excuses enable row level security;

-- Lecture : la Direction, et le formateur concerné.
create policy "absence_excuses_select"
  on public.absence_excuses for select to authenticated
  using (
    public.is_pedagogy_manager()
    or profile_id = public.current_profile_id()
  );

create policy "absence_excuses_insert"
  on public.absence_excuses for insert to authenticated
  with check (
    public.is_pedagogy_manager()
    and created_by = public.current_clerk_id()
  );

create policy "absence_excuses_update"
  on public.absence_excuses for update to authenticated
  using (public.is_pedagogy_manager())
  with check (public.is_pedagogy_manager());

revoke all on public.absence_excuses from anon;
revoke delete, truncate on public.absence_excuses from authenticated;
