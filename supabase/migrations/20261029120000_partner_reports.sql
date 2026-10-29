-- Rapports validés visibles par les directeurs partenaires.
--
-- Dès qu'un rapport est validé par la Direction pédagogique, le directeur de
-- l'école (et ses adjoints) le lit dans son espace, pendant 30 jours.
--
-- La table `daily_reports` n'est PAS ouverte aux directeurs (elle contient le
-- commentaire de la Direction et le détail des pannes). Ils passent par une
-- fonction `security definer` qui ne renvoie que les champs prévus :
-- jamais le commentaire de la Direction, l'historique des corrections, les
-- pannes, ni les brouillons.

-- ---------------------------------------------------------------------------
-- 1. partner_reports : rapports validés des écoles de l'appelant (30 jours)
-- ---------------------------------------------------------------------------
create or replace function public.partner_reports()
returns table (
  out_id uuid,
  out_school_id uuid,
  out_school_name text,
  out_report_date date,
  out_slot_starts time,
  out_slot_ends time,
  out_formateur text,
  out_courses jsonb,
  out_classes text,
  out_course_theme text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.school_id,
    s.name,
    r.report_date,
    t.starts_at,
    t.ends_at,
    p.full_name,
    -- Seuls les champs d'un cours sont recopiés (rien d'autre du JSON).
    case
      when jsonb_typeof(r.courses) = 'array' then (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'startsAt', c.item ->> 'startsAt',
              'endsAt', c.item ->> 'endsAt',
              'classes', c.item ->> 'classes',
              'theme', c.item ->> 'theme',
              'headcount', c.item -> 'headcount'
            )
            order by c.ord
          ),
          '[]'::jsonb
        )
        from jsonb_array_elements(r.courses) with ordinality as c(item, ord)
      )
      else '[]'::jsonb
    end,
    r.classes,
    r.course_theme
  from public.daily_reports r
  join public.schools s on s.id = r.school_id
  join public.time_slots t on t.id = r.slot_id
  join public.profiles p on p.id = r.profile_id
  where r.status in ('valide', 'valide_avec_corrections')
    and r.report_date >= ((now() at time zone 'Africa/Dakar')::date - 30)
    and exists (
      select 1
      from public.school_directors d
      join public.profiles me on me.id = d.profile_id
      where d.school_id = r.school_id
        and d.status = 'actif'
        and d.profile_id = public.current_profile_id()
        and me.status = 'actif'
        and me.role = 'directeur_partenaire'
    )
  order by r.report_date desc, t.starts_at desc, s.name
  limit 200
$$;

revoke all on function public.partner_reports() from public, anon;
grant execute on function public.partner_reports() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Notification : un rapport vient d'être validé -> les directeurs de l'école
-- ---------------------------------------------------------------------------
-- Une seule cloche à la fois par école : tant que la précédente n'est pas lue,
-- un nouveau rapport validé n'en crée pas d'autre (sinon, un message par cours).
-- Le texte ne contient que l'école, jamais le contenu du rapport.
alter table public.notifications
  drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in (
    'report_validated', 'report_corrected', 'report_to_modify',
    'report_submitted', 'ticket_created', 'ticket_assigned',
    'bilan_published', 'incident', 'ticket_received', 'code_ready',
    'deputy_invited', 'reports_available'
  ));

create or replace function public.notify_reports_available()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school text;
begin
  select name into v_school from public.schools where id = new.school_id;

  insert into public.notifications (profile_id, kind, title, body, link, entity_id)
  select
    p.id,
    'reports_available',
    'Nouveaux rapports',
    left(
      'De nouveaux rapports validés sont disponibles pour '
        || coalesce(v_school, 'votre école') || '.',
      300
    ),
    '/partenaire/rapports',
    new.school_id
  from public.school_directors d
  join public.profiles p on p.id = d.profile_id
  where d.school_id = new.school_id
    and d.status = 'actif'
    and p.status = 'actif'
    and p.role = 'directeur_partenaire'
    and not exists (
      select 1
      from public.notifications n
      where n.profile_id = p.id
        and n.kind = 'reports_available'
        and n.entity_id = new.school_id
        and n.read_at is null
    );

  return new;
end;
$$;

revoke all on function public.notify_reports_available() from public, anon, authenticated;

create trigger daily_reports_notify_available
  after update of status on public.daily_reports
  for each row
  when (
    new.status in ('valide', 'valide_avec_corrections')
    and old.status not in ('valide', 'valide_avec_corrections')
  )
  execute function public.notify_reports_available();
