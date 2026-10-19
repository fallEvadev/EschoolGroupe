-- Pointage en deux temps : arrivée sans code, descente avec le code du directeur.
--
-- Décisions d'Awa (octobre 2026) :
--   * À l'arrivée, le formateur pointe sans code (heure + position GPS).
--   * Le rapport journalier se fait à la descente : son formulaire ne s'ouvre
--     que 10 minutes avant la fin du créneau.
--   * Le code du jour est donné par le directeur APRÈS le cours : il n'est
--     accepté qu'à partir de la fin exacte du créneau, et sa saisie enregistre
--     l'heure de descente. Le directeur ne le voit qu'à partir de cette heure.
--   * L'envoi du rapport ne dépend PAS de la descente : le formateur envoie dès
--     qu'il a fini, puis la Direction valide. La descente se suit à part ; si
--     le directeur est absent, la Direction pédagogique peut la valider avec un
--     motif.
--
-- Les pointages et rapports déjà enregistrés ne changent pas : ils gardent
-- l'ancien fonctionnement (`requires_departure` faux).
--
-- Fuseau : toutes les heures se lisent à Dakar (UTC+0, sans heure d'été).

-- ---------------------------------------------------------------------------
-- 1. Colonnes de descente sur les pointages
-- ---------------------------------------------------------------------------
alter table public.attendances
  add column requires_departure boolean not null default false,
  add column departed_at timestamptz,
  add column departure_source text,
  add column departure_reason text;

-- Les anciens pointages gardent « faux » (valeur par défaut ci-dessus) ; les
-- nouveaux exigent une descente.
alter table public.attendances
  alter column requires_departure set default true;

alter table public.attendances
  add constraint attendances_departure_coherent check (
    (departed_at is null) = (departure_source is null)
    and (departed_at is null or requires_departure)
    and (departure_source is null or departure_source in ('code', 'direction'))
    and (departure_source is distinct from 'direction'
         or char_length(coalesce(departure_reason, '')) between 3 and 300)
    and (departure_source = 'direction' or departure_reason is null)
  );

-- ---------------------------------------------------------------------------
-- 2. record_departure : enregistre la descente d'un formateur
-- ---------------------------------------------------------------------------
-- Une seule transaction : le pointage est verrouillé, l'heure est contrôlée
-- AVANT de compter un essai de code (un code donné trop tôt n'use pas les 5
-- essais), puis le code et la limite d'essais sont contrôlés par
-- `verify_attendance_code`. Appelable par la clé de service seulement : le
-- serveur a déjà identifié le formateur par son jeton.
create or replace function public.record_departure(
  p_profile_id uuid,
  p_attendance_id uuid,
  p_code text
)
returns table (
  out_outcome text,
  out_remaining integer,
  out_minutes_left integer,
  out_departed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_att public.attendances%rowtype;
  v_ends time;
  v_now timestamp := now() at time zone 'Africa/Dakar';
  v_check record;
begin
  select * into v_att
    from public.attendances
    where id = p_attendance_id and profile_id = p_profile_id
    for update;
  if not found then
    return query select 'not_found'::text, 0, 0, null::timestamptz;
    return;
  end if;
  if not v_att.requires_departure then
    return query select 'not_required'::text, 0, 0, null::timestamptz;
    return;
  end if;
  if v_att.departed_at is not null then
    return query select 'already'::text, 0, 0, v_att.departed_at;
    return;
  end if;

  select ends_at into v_ends from public.time_slots where id = v_att.slot_id;

  -- La descente se valide le jour même ; après, c'est à la Direction.
  if v_att.attendance_date <> v_now::date then
    return query select 'expired'::text, 0, 0, null::timestamptz;
    return;
  end if;

  -- Pas avant la fin exacte du créneau.
  if v_now::time < v_ends then
    return query select
      'too_early'::text,
      0,
      greatest(1, ceil(extract(epoch from (v_ends - v_now::time)) / 60))::integer,
      null::timestamptz;
    return;
  end if;

  select * into v_check
    from public.verify_attendance_code(
      p_profile_id, v_att.school_id, v_att.attendance_date, p_code
    );
  if v_check.outcome <> 'ok' then
    return query select
      v_check.outcome, v_check.remaining, v_check.minutes_left, null::timestamptz;
    return;
  end if;

  update public.attendances
    set departed_at = now(), departure_source = 'code'
    where id = p_attendance_id;

  return query select 'ok'::text, v_check.remaining, 0, now();
end;
$$;

revoke all on function public.record_departure(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.record_departure(uuid, uuid, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 3. La Direction valide une descente quand le directeur n'a pas pu donner le code
-- ---------------------------------------------------------------------------
create or replace function public.set_departure_by_direction(
  p_attendance_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_att public.attendances%rowtype;
  v_ends time;
  v_end_moment timestamptz;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not public.is_pedagogy_manager() then
    raise exception 'Action réservée à la Direction pédagogique.'
      using errcode = '42501';
  end if;
  if char_length(v_reason) not between 3 and 300 then
    raise exception 'Le motif doit faire entre 3 et 300 caractères.'
      using errcode = '22023';
  end if;

  select * into v_att from public.attendances where id = p_attendance_id for update;
  if not found then
    raise exception 'Pointage introuvable.' using errcode = 'P0002';
  end if;
  if not v_att.requires_departure then
    raise exception 'Ce pointage n''a pas de descente à valider.'
      using errcode = '23514';
  end if;
  if v_att.departed_at is not null then
    raise exception 'La descente est déjà validée.' using errcode = '23514';
  end if;

  select ends_at into v_ends from public.time_slots where id = v_att.slot_id;
  -- Heure de descente retenue : la fin du créneau (jamais dans le futur).
  v_end_moment := ((v_att.attendance_date + v_ends) at time zone 'Africa/Dakar');

  update public.attendances
    set departed_at = least(now(), v_end_moment),
        departure_source = 'direction',
        departure_reason = v_reason
    where id = p_attendance_id;
end;
$$;

revoke all on function public.set_departure_by_direction(uuid, text)
  from public, anon;
grant execute on function public.set_departure_by_direction(uuid, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Rapport : fermé jusqu'à 10 minutes avant la fin du cours
-- ---------------------------------------------------------------------------
-- S'applique aux écritures du formateur (la Direction traite les rapports
-- envoyés, ce n'est pas concerné). Ne regarde que les pointages qui exigent une
-- descente : les anciens rapports restent modifiables comme avant. Une fois le
-- rapport ouvert, le formateur peut l'enregistrer ET l'envoyer librement.
create or replace function public.guard_report_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_att record;
  v_now timestamp := now() at time zone 'Africa/Dakar';
begin
  if public.is_pedagogy_manager() then
    return new;
  end if;

  select a.requires_departure, a.attendance_date, s.ends_at
    into v_att
    from public.attendances a
    join public.time_slots s on s.id = a.slot_id
    where a.id = new.attendance_id;
  if not found or not v_att.requires_departure then
    return new;
  end if;

  -- Avant le jour du cours, ou le jour même avant (fin - 10 min) : fermé.
  -- (Comparaison en minutes depuis minuit : « fin - 10 min » ne fait pas le tour
  -- de l'horloge pour un cours qui finit juste après minuit.)
  if v_now::date < v_att.attendance_date
     or (v_now::date = v_att.attendance_date
         and extract(epoch from v_now::time) / 60
             < extract(epoch from v_att.ends_at) / 60 - 10) then
    raise exception 'Le rapport s''ouvre 10 minutes avant la fin du cours.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger daily_reports_window
  before insert or update on public.daily_reports
  for each row execute function public.guard_report_window();

-- ---------------------------------------------------------------------------
-- 5. Code du jour : le directeur ne le voit qu'à la fin du cours
-- ---------------------------------------------------------------------------
-- Il lisait la table directement toute la journée. La lecture directe est
-- retirée : il passe par cette fonction, qui ne donne le code qu'à partir de la
-- fin du premier créneau du jour de l'école. Le serveur refuse de toute façon
-- le code avant la fin du créneau de chaque formateur (`record_departure`).
drop policy "daily_codes_select" on public.daily_codes;

create policy "daily_codes_select"
  on public.daily_codes for select to authenticated
  using (public.is_pedagogy_manager());

create or replace function public.partner_codes_today()
returns table (
  out_school_id uuid,
  out_school_name text,
  out_first_end time,
  out_has_code boolean,
  out_code text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_now timestamp := now() at time zone 'Africa/Dakar';
begin
  return query
    select
      s.id,
      s.name,
      fe.first_end,
      (c.code is not null),
      case
        when c.code is not null
         and fe.first_end is not null
         and v_now::time >= fe.first_end
        then c.code
      end
    from public.schools s
    join public.school_directors d
      on d.school_id = s.id
     and d.status = 'actif'
     and d.profile_id = public.current_profile_id()
    left join lateral (
      select min(t.ends_at) as first_end
        from public.time_slots t
        where t.school_id = s.id
          and t.status = 'actif'
          and t.weekday = extract(isodow from v_now)::integer
    ) fe on true
    left join public.daily_codes c
      on c.school_id = s.id
     and c.code_date = v_now::date
     and c.status = 'actif'
    where s.status = 'actif'
    order by s.name;
end;
$$;

revoke all on function public.partner_codes_today() from public, anon;
grant execute on function public.partner_codes_today() to authenticated;
