-- Tableau de bord de l'espace admin : totaux pour les graphiques.
--
-- Chaque fonction renvoie seulement des TOTAUX (par jour, par semaine, par rôle),
-- calculés par la base. Lire les lignes une à une serait faux dès que le volume
-- dépasse la limite de 1 000 lignes par lecture, et plus lent sur connexion
-- lente. Aucune donnée personnelle n'est renvoyée, aucune table n'est créée.
--
-- Elles s'exécutent avec les droits de l'appelant (la RLS s'applique) ET vérifient
-- le rôle à la main : un utilisateur sans le droit reçoit une erreur claire.
-- Les semaines commencent le lundi (norme ISO), comme les bilans.

-- ---------------------------------------------------------------------------
-- Pointages par jour et par statut (Direction pédagogique)
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_attendance_by_day(p_from date)
returns table (out_day date, out_status text, out_count integer)
language plpgsql
stable
as $$
begin
  if not public.is_pedagogy_manager() then
    raise exception 'Action réservée à la Direction pédagogique.'
      using errcode = '42501';
  end if;

  return query
    select a.attendance_date, a.status, count(*)::integer
    from public.attendances a
    where a.attendance_date >= p_from
    group by a.attendance_date, a.status
    order by a.attendance_date, a.status;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rapports envoyés par semaine et par statut (Direction pédagogique)
-- ---------------------------------------------------------------------------
-- Les brouillons ne comptent pas : ils n'ont pas été envoyés. `p_from` est un
-- lundi ; la semaine d'un rapport est identifiée par son lundi.
create or replace function public.dashboard_reports_by_week(p_from date)
returns table (out_week date, out_status text, out_count integer)
language plpgsql
stable
as $$
begin
  if not public.is_pedagogy_manager() then
    raise exception 'Action réservée à la Direction pédagogique.'
      using errcode = '42501';
  end if;

  return query
    select
      (r.report_date - (extract(isodow from r.report_date)::integer - 1)),
      r.status,
      count(*)::integer
    from public.daily_reports r
    where r.report_date >= p_from
      and r.status <> 'brouillon'
    group by 1, 2
    order by 1, 2;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tickets ouverts par semaine (gestion de la maintenance)
-- ---------------------------------------------------------------------------
-- Le jour d'ouverture est celui de Dakar.
create or replace function public.dashboard_tickets_by_week(p_from date)
returns table (out_week date, out_count integer)
language plpgsql
stable
as $$
begin
  if not public.is_maintenance_manager() then
    raise exception 'Action réservée à la gestion de la maintenance.'
      using errcode = '42501';
  end if;

  return query
    select
      (d.day - (extract(isodow from d.day)::integer - 1)),
      count(*)::integer
    from (
      select (t.opened_at at time zone 'Africa/Dakar')::date as day
      from public.maintenance_tickets t
    ) d
    where d.day >= p_from
    group by 1
    order by 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- Personnel par rôle et par statut (Admin RH et Super-Admin)
-- ---------------------------------------------------------------------------
-- Seulement des totaux : ni nom, ni e-mail, ni téléphone.
create or replace function public.dashboard_staff_by_role()
returns table (out_role text, out_status text, out_count integer)
language plpgsql
stable
as $$
begin
  if coalesce(public.current_user_role() in ('admin_rh', 'super_admin'), false) = false then
    raise exception 'Action réservée à l''Admin RH.' using errcode = '42501';
  end if;

  return query
    select p.role::text, p.status, count(*)::integer
    from public.profiles p
    group by p.role, p.status
    order by p.role, p.status;
end;
$$;

revoke all on function
  public.dashboard_attendance_by_day(date),
  public.dashboard_reports_by_week(date),
  public.dashboard_tickets_by_week(date),
  public.dashboard_staff_by_role()
from public, anon;
grant execute on function
  public.dashboard_attendance_by_day(date),
  public.dashboard_reports_by_week(date),
  public.dashboard_tickets_by_week(date),
  public.dashboard_staff_by_role()
to authenticated;
