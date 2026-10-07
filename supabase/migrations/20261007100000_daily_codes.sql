-- Lot 3 — Pointage (étape 2) : codes quotidiens par école.
-- Un code à 6 chiffres par école et par jour, généré par la Direction
-- pédagogique et transmis au directeur partenaire. Les formateurs ne lisent
-- jamais un code : le contrôle se fait côté serveur (étape 3.3).

-- ---------------------------------------------------------------------------
-- daily_codes : une ligne par code généré
-- ---------------------------------------------------------------------------
create table public.daily_codes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  -- Jour de validité, en heure de Dakar (Africa/Dakar = UTC, sans heure d'été).
  code_date date not null,
  code text not null check (code ~ '^[0-9]{6}$'),
  -- Aucune suppression : un code régénéré passe en « remplace ».
  status text not null default 'actif' check (status in ('actif', 'remplace')),
  generated_by text,
  created_at timestamptz not null default now()
);

-- Un seul code actif par école et par jour.
create unique index daily_codes_active_school_day_unique
  on public.daily_codes (school_id, code_date) where status = 'actif';

-- Deux écoles n'ont jamais le même code actif le même jour : un code ne peut
-- pas servir à pointer dans la mauvaise école.
create unique index daily_codes_active_code_day_unique
  on public.daily_codes (code_date, code) where status = 'actif';

create index daily_codes_date_idx on public.daily_codes (code_date);

alter table public.daily_codes enable row level security;

-- Lecture : la Direction pédagogique et les directeurs rattachés à l'école.
-- Aucune politique pour les formateurs.
create policy "daily_codes_select"
  on public.daily_codes for select to authenticated
  using (
    public.is_pedagogy_manager()
    or exists (
      select 1 from public.school_directors d
      where d.school_id = daily_codes.school_id
        and d.status = 'actif'
        and d.profile_id = public.current_profile_id()
    )
  );

create policy "daily_codes_insert"
  on public.daily_codes for insert to authenticated
  with check (public.is_pedagogy_manager());

create policy "daily_codes_update"
  on public.daily_codes for update to authenticated
  using (public.is_pedagogy_manager())
  with check (public.is_pedagogy_manager());

-- Pas de suppression physique, et rien pour les visiteurs anonymes.
revoke all on public.daily_codes from anon;
revoke delete, truncate on public.daily_codes from authenticated;

-- ---------------------------------------------------------------------------
-- replace_daily_code : régénère le code d'une école, en une seule transaction
-- ---------------------------------------------------------------------------
-- L'ancien code actif passe en « remplace » et le nouveau est inséré. Si
-- l'insertion échoue (code déjà pris par une autre école ce jour-là), tout est
-- annulé : l'ancien code reste actif. La fonction s'exécute avec les droits de
-- l'appelant : la RLS ci-dessus s'applique.
create or replace function public.replace_daily_code(
  p_school_id uuid,
  p_code_date date,
  p_code text
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  update public.daily_codes
    set status = 'remplace'
    where school_id = p_school_id
      and code_date = p_code_date
      and status = 'actif';

  insert into public.daily_codes (school_id, code_date, code, generated_by)
    values (p_school_id, p_code_date, p_code, public.current_clerk_id())
    returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.replace_daily_code(uuid, date, text) from public, anon;
grant execute on function public.replace_daily_code(uuid, date, text) to authenticated;
