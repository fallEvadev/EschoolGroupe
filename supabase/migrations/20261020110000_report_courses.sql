-- Rapport journalier : plusieurs cours dans un seul rapport
-- ---------------------------------------------------------------------------
-- Un rapport (un pointage) peut maintenant contenir plusieurs cours. Chaque cours
-- a : heure de début, heure de fin, classe, thème, effectif des élèves présents.
--
--   courses  = [{ "startsAt": "08:00", "endsAt": "09:00", "classes": "CI B",
--                 "theme": "…", "headcount": 28 }, …]
--
-- Les colonnes `classes` et `course_theme` restent : le serveur y écrit un
-- résumé des cours, ce qui garde intacts les bilans, les contraintes d'envoi et
-- les anciennes lectures. Un rapport d'avant (courses = []) est relu comme un
-- seul cours sans heures ni effectif.

alter table public.daily_reports
  add column courses jsonb not null default '[]'::jsonb
    check (jsonb_typeof(courses) = 'array' and jsonb_array_length(courses) <= 12);

-- ---------------------------------------------------------------------------
-- Envoi : l'historique garde aussi les cours
-- ---------------------------------------------------------------------------
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
        'courses', v_report.courses,
        'classes', v_report.classes,
        'course_theme', v_report.course_theme,
        'equipment_ok', v_report.equipment_ok,
        'equipment_issues', v_report.equipment_issues
      )
    );

  return v_version;
end;
$$;

-- ---------------------------------------------------------------------------
-- Décision de la Direction : les corrections portent aussi sur les cours
-- ---------------------------------------------------------------------------
-- Nouveau paramètre `p_courses` ; l'ancienne signature disparaît pour ne pas
-- laisser deux versions de la fonction.
drop function public.review_daily_report(uuid, text, text, text, text, boolean, jsonb);

create or replace function public.review_daily_report(
  p_report_id uuid,
  p_decision text,
  p_comment text default null,
  p_classes text default null,
  p_course_theme text default null,
  p_equipment_ok boolean default null,
  p_equipment_issues jsonb default null,
  p_courses jsonb default null
)
returns integer
language plpgsql
as $$
declare
  v_report public.daily_reports%rowtype;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_classes text;
  v_theme text;
  v_courses jsonb;
  v_ok boolean;
  v_issues jsonb;
  v_version integer;
begin
  if not public.is_pedagogy_manager() then
    raise exception 'Action réservée à la Direction pédagogique.'
      using errcode = '42501';
  end if;

  if p_decision not in ('valide', 'valide_avec_corrections', 'a_modifier') then
    raise exception 'Décision invalide.' using errcode = '22023';
  end if;

  if p_courses is not null
     and (jsonb_typeof(p_courses) <> 'array'
          or jsonb_array_length(p_courses) not between 1 and 12) then
    raise exception 'Liste de cours invalide.' using errcode = '22023';
  end if;

  select * into v_report
    from public.daily_reports
    where id = p_report_id
    for update;

  if not found then
    raise exception 'Rapport introuvable.' using errcode = 'P0002';
  end if;
  if v_report.status <> 'soumis' then
    raise exception 'Ce rapport n''est pas en attente de décision.'
      using errcode = '23514';
  end if;

  v_classes := coalesce(p_classes, v_report.classes);
  v_theme := coalesce(p_course_theme, v_report.course_theme);
  v_courses := coalesce(p_courses, v_report.courses);
  v_ok := coalesce(p_equipment_ok, v_report.equipment_ok);
  v_issues := coalesce(p_equipment_issues, v_report.equipment_issues);

  if p_decision = 'a_modifier' and (v_comment is null or char_length(v_comment) < 3) then
    raise exception 'Expliquez ce que le formateur doit modifier.'
      using errcode = '22023';
  end if;

  if p_decision = 'valide_avec_corrections' then
    -- Une « correction » change vraiment quelque chose.
    if v_classes = v_report.classes
       and v_theme = v_report.course_theme
       and v_courses = v_report.courses
       and v_ok = v_report.equipment_ok
       and v_issues = v_report.equipment_issues then
      raise exception 'Aucune correction apportée : validez le rapport tel quel.'
        using errcode = '22023';
    end if;
  elsif p_classes is not null
        or p_course_theme is not null
        or p_courses is not null
        or p_equipment_ok is not null
        or p_equipment_issues is not null then
    raise exception 'Seule une validation avec corrections modifie le contenu.'
      using errcode = '22023';
  end if;

  update public.daily_reports
    set status = p_decision,
        classes = v_classes,
        course_theme = v_theme,
        courses = v_courses,
        equipment_ok = v_ok,
        equipment_issues = v_issues,
        review_comment = v_comment,
        reviewed_by = public.current_clerk_id(),
        reviewed_at = now()
    where id = p_report_id;

  select coalesce(max(version), 0) + 1
    into v_version
    from public.report_revisions
    where report_id = p_report_id;

  insert into public.report_revisions
    (report_id, version, kind, author, snapshot, comment)
    values (
      p_report_id,
      v_version,
      case p_decision
        when 'valide' then 'validation'
        when 'valide_avec_corrections' then 'correction'
        else 'demande_modification'
      end,
      public.current_clerk_id(),
      jsonb_build_object(
        'courses', v_courses,
        'classes', v_classes,
        'course_theme', v_theme,
        'equipment_ok', v_ok,
        'equipment_issues', v_issues
      ),
      v_comment
    );

  return v_version;
end;
$$;

revoke all on function public.review_daily_report(uuid, text, text, text, text, boolean, jsonb, jsonb)
  from public, anon;
grant execute on function public.review_daily_report(uuid, text, text, text, text, boolean, jsonb, jsonb)
  to authenticated;
