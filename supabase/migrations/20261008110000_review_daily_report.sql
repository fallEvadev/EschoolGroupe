-- Lot 4 — Rapports journaliers (étape 2) : décision de la Direction pédagogique.
--
-- Trois décisions sur un rapport « soumis » :
--   valide                   -> verrouillé tel quel
--   valide_avec_corrections  -> la Direction corrige le contenu, puis verrouillé
--   a_modifier               -> retourne au formateur, commentaire obligatoire
-- Chaque décision ajoute une ligne à `report_revisions` (contenu final +
-- commentaire) : l'historique garde la version envoyée par le formateur.

-- ---------------------------------------------------------------------------
-- Droit de modification pour la Direction (jusqu'ici seul le formateur en avait)
-- ---------------------------------------------------------------------------
-- Le rapport doit être « soumis » avant, et l'une des trois décisions après,
-- au nom de l'utilisateur connecté.
create policy "daily_reports_update_manager"
  on public.daily_reports for update to authenticated
  using (public.is_pedagogy_manager() and status = 'soumis')
  with check (
    public.is_pedagogy_manager()
    and status in ('valide', 'valide_avec_corrections', 'a_modifier')
    and reviewed_by = public.current_clerk_id()
  );

-- ---------------------------------------------------------------------------
-- Garde-fou : la Direction ne laisse pas un rapport « soumis » modifié en
-- cachette (toute modification doit se terminer par une décision).
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
    -- La Direction ne traite que les rapports soumis, et rend une décision.
    if old.status <> 'soumis'
       or new.status not in ('valide', 'valide_avec_corrections', 'a_modifier') then
      raise exception 'Seul un rapport soumis peut être traité, par une décision.'
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

-- ---------------------------------------------------------------------------
-- review_daily_report : la Direction rend sa décision
-- ---------------------------------------------------------------------------
-- Une seule transaction, ligne verrouillée : deux décisions simultanées ne
-- peuvent pas se croiser. Droits de l'appelant : la RLS et le déclencheur
-- s'appliquent, et la fonction vérifie elle-même le rôle.
-- Les paramètres de contenu (p_classes…) ne servent qu'à « valide_avec_corrections » ;
-- un paramètre laissé vide garde la valeur envoyée par le formateur.
create or replace function public.review_daily_report(
  p_report_id uuid,
  p_decision text,
  p_comment text default null,
  p_classes text default null,
  p_course_theme text default null,
  p_equipment_ok boolean default null,
  p_equipment_issues jsonb default null
)
returns integer
language plpgsql
as $$
declare
  v_report public.daily_reports%rowtype;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_classes text;
  v_theme text;
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
       and v_ok = v_report.equipment_ok
       and v_issues = v_report.equipment_issues then
      raise exception 'Aucune correction apportée : validez le rapport tel quel.'
        using errcode = '22023';
    end if;
  elsif p_classes is not null
        or p_course_theme is not null
        or p_equipment_ok is not null
        or p_equipment_issues is not null then
    raise exception 'Seule une validation avec corrections modifie le contenu.'
      using errcode = '22023';
  end if;

  update public.daily_reports
    set status = p_decision,
        classes = v_classes,
        course_theme = v_theme,
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

revoke all on function public.review_daily_report(uuid, text, text, text, text, boolean, jsonb)
  from public, anon;
grant execute on function public.review_daily_report(uuid, text, text, text, text, boolean, jsonb)
  to authenticated;
