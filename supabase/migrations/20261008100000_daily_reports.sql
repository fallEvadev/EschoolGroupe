-- Lot 4 — Rapports journaliers (étape 1) : saisie par le formateur.
--
-- Un rapport est LIÉ À UN POINTAGE (un seul par pointage). Cycle :
--   brouillon -> soumis -> valide | valide_avec_corrections | a_modifier
--   a_modifier -> soumis (le formateur corrige puis renvoie)
-- Un rapport validé est VERROUILLÉ par la base elle-même (déclencheur), pas
-- seulement par l'interface. La validation par la Direction vient à l'étape 2 ;
-- le déclencheur ci-dessous connaît déjà ses transitions.
--
-- Les pannes sont des lignes structurées (identifiant, équipement, description)
-- dans `equipment_issues` : le Lot 5 en fera des tickets de maintenance. Aucun
-- ticket n'est créé ici.

-- ---------------------------------------------------------------------------
-- daily_reports : un rapport par pointage
-- ---------------------------------------------------------------------------
create table public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null unique references public.attendances (id),
  -- Recopiés du pointage (jamais modifiables) pour les listes, filtres et la RLS.
  profile_id uuid not null references public.profiles (id),
  school_id uuid not null references public.schools (id),
  slot_id uuid not null references public.time_slots (id),
  report_date date not null,
  -- Ce que remplit le formateur.
  classes text not null default '' check (char_length(classes) <= 300),
  course_theme text not null default ''
    check (char_length(course_theme) <= 1000),
  -- Vrai : tout le matériel fonctionne. Faux : au moins une panne ci-dessous.
  equipment_ok boolean not null default true,
  equipment_issues jsonb not null default '[]'::jsonb
    check (
      jsonb_typeof(equipment_issues) = 'array'
      and jsonb_array_length(equipment_issues) <= 20
    ),
  status text not null default 'brouillon'
    check (
      status in (
        'brouillon',
        'soumis',
        'valide',
        'valide_avec_corrections',
        'a_modifier'
      )
    ),
  -- Décision de la Direction (renseignée à l'étape 2).
  review_comment text
    check (review_comment is null or char_length(review_comment) <= 500),
  submitted_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Cohérence du matériel : « tout fonctionne » n'a aucune panne, sinon au moins une.
  check (
    (equipment_ok and jsonb_array_length(equipment_issues) = 0)
    or (not equipment_ok and jsonb_array_length(equipment_issues) >= 1)
  ),
  -- Un rapport envoyé est complet.
  check (
    status = 'brouillon'
    or (
      char_length(btrim(classes)) >= 2
      and char_length(btrim(course_theme)) >= 3
    )
  ),
  -- Une demande de modification s'explique : le formateur lit ce motif.
  check (
    status <> 'a_modifier'
    or (review_comment is not null and char_length(btrim(review_comment)) >= 3)
  )
);

create index daily_reports_profile_idx
  on public.daily_reports (profile_id, report_date desc);
create index daily_reports_status_idx
  on public.daily_reports (status, report_date desc);

create trigger daily_reports_set_updated_at
  before update on public.daily_reports
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Garde-fous : verrouillage et transitions autorisées
-- ---------------------------------------------------------------------------
create or replace function public.guard_daily_report()
returns trigger
language plpgsql
as $$
declare
  v_manager boolean := public.is_pedagogy_manager();
begin
  -- Un rapport validé ne bouge plus, pour personne.
  if old.status in ('valide', 'valide_avec_corrections') then
    raise exception 'Un rapport validé est verrouillé.' using errcode = '23514';
  end if;

  -- Ce qui vient du pointage ne se modifie jamais.
  if new.attendance_id <> old.attendance_id
     or new.profile_id <> old.profile_id
     or new.school_id <> old.school_id
     or new.slot_id <> old.slot_id
     or new.report_date <> old.report_date then
    raise exception 'Le pointage, l''école et la date d''un rapport ne se modifient pas.'
      using errcode = '23514';
  end if;

  if v_manager then
    -- La Direction ne traite que les rapports soumis.
    if old.status <> 'soumis'
       or new.status not in (
         'soumis', 'valide', 'valide_avec_corrections', 'a_modifier'
       ) then
      raise exception 'Seul un rapport soumis peut être traité par la Direction.'
        using errcode = '23514';
    end if;
  else
    -- Le formateur n'écrit ni la décision de la Direction, ni son statut final.
    if new.review_comment is distinct from old.review_comment
       or new.reviewed_by is distinct from old.reviewed_by
       or new.reviewed_at is distinct from old.reviewed_at then
      raise exception 'La décision de la Direction ne se modifie pas.'
        using errcode = '23514';
    end if;
    if not (
      (old.status = 'brouillon' and new.status in ('brouillon', 'soumis'))
      or (old.status = 'a_modifier' and new.status in ('a_modifier', 'soumis'))
    ) then
      raise exception 'Ce rapport n''est plus modifiable.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger daily_reports_guard
  before update on public.daily_reports
  for each row execute function public.guard_daily_report();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.daily_reports enable row level security;

-- Lecture : le formateur voit les siens ; la Direction voit les rapports
-- envoyés (pas les brouillons).
create policy "daily_reports_select"
  on public.daily_reports for select to authenticated
  using (
    profile_id = public.current_profile_id()
    or (public.is_pedagogy_manager() and status <> 'brouillon')
  );

-- Création : un formateur, pour SON pointage, en brouillon. Le pointage ne doit
-- pas avoir été refusé par la Direction, et les champs recopiés doivent
-- correspondre exactement à ce pointage.
create policy "daily_reports_insert"
  on public.daily_reports for insert to authenticated
  with check (
    profile_id = public.current_profile_id()
    and status = 'brouillon'
    and exists (
      select 1 from public.attendances a
      where a.id = attendance_id
        and a.profile_id = public.current_profile_id()
        and a.school_id = daily_reports.school_id
        and a.slot_id = daily_reports.slot_id
        and a.attendance_date = daily_reports.report_date
        and not exists (
          select 1 from public.attendance_reviews r
          where r.attendance_id = a.id and r.decision = 'refuse'
        )
    )
  );

-- Modification par le formateur : seulement un brouillon ou un rapport à
-- modifier, et il peut le passer à « soumis ».
create policy "daily_reports_update_owner"
  on public.daily_reports for update to authenticated
  using (
    profile_id = public.current_profile_id()
    and status in ('brouillon', 'a_modifier')
  )
  with check (
    profile_id = public.current_profile_id()
    and status in ('brouillon', 'a_modifier', 'soumis')
  );

-- Pas de suppression physique, et rien pour les visiteurs anonymes.
revoke all on public.daily_reports from anon;
revoke delete, truncate on public.daily_reports from authenticated;

-- ---------------------------------------------------------------------------
-- report_revisions : historique du contenu, en ajout seul
-- ---------------------------------------------------------------------------
create table public.report_revisions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports (id),
  -- 1, 2, 3… par rapport.
  version integer not null check (version >= 1),
  kind text not null
    check (
      kind in (
        'soumission',
        'resoumission',
        'correction',
        'validation',
        'demande_modification'
      )
    ),
  author text not null,
  -- Contenu du rapport à ce moment-là (classes, thème, matériel, pannes).
  snapshot jsonb not null,
  comment text check (comment is null or char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  unique (report_id, version)
);

alter table public.report_revisions enable row level security;

-- Lecture : le formateur concerné et la Direction.
create policy "report_revisions_select"
  on public.report_revisions for select to authenticated
  using (
    public.is_pedagogy_manager()
    or exists (
      select 1 from public.daily_reports r
      where r.id = report_id and r.profile_id = public.current_profile_id()
    )
  );

-- Ajout : au nom de l'utilisateur connecté, pour le rapport du formateur
-- (soumission) ou par la Direction (étape 2).
create policy "report_revisions_insert"
  on public.report_revisions for insert to authenticated
  with check (
    author = public.current_clerk_id()
    and (
      public.is_pedagogy_manager()
      or exists (
        select 1 from public.daily_reports r
        where r.id = report_id and r.profile_id = public.current_profile_id()
      )
    )
  );

-- Un historique ne se réécrit pas : ni modification ni suppression.
revoke all on public.report_revisions from anon;
revoke update, delete, truncate on public.report_revisions from authenticated;

-- ---------------------------------------------------------------------------
-- submit_daily_report : le formateur envoie son rapport à la Direction
-- ---------------------------------------------------------------------------
-- Une seule transaction : passage à « soumis » ET entrée dans l'historique. Le
-- rapport est verrouillé pendant l'opération (deux envois simultanés ne
-- peuvent pas se croiser). Elle s'exécute avec les droits de l'appelant : la
-- RLS et le déclencheur ci-dessus s'appliquent.
create or replace function public.submit_daily_report(p_report_id uuid)
returns integer
language plpgsql
as $$
declare
  v_report public.daily_reports%rowtype;
  v_version integer;
begin
  select * into v_report
    from public.daily_reports
    where id = p_report_id
    for update;

  if not found then
    raise exception 'Rapport introuvable.' using errcode = 'P0002';
  end if;
  if v_report.status not in ('brouillon', 'a_modifier') then
    raise exception 'Ce rapport n''est plus modifiable.' using errcode = '23514';
  end if;

  update public.daily_reports
    set status = 'soumis', submitted_at = now()
    where id = p_report_id;

  select coalesce(max(version), 0) + 1
    into v_version
    from public.report_revisions
    where report_id = p_report_id;

  insert into public.report_revisions (report_id, version, kind, author, snapshot)
    values (
      p_report_id,
      v_version,
      case when v_version = 1 then 'soumission' else 'resoumission' end,
      public.current_clerk_id(),
      jsonb_build_object(
        'classes', v_report.classes,
        'course_theme', v_report.course_theme,
        'equipment_ok', v_report.equipment_ok,
        'equipment_issues', v_report.equipment_issues
      )
    );

  return v_version;
end;
$$;

revoke all on function public.submit_daily_report(uuid) from public, anon;
grant execute on function public.submit_daily_report(uuid) to authenticated;
