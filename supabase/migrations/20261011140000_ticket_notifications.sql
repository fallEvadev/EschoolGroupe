-- Lot 5 — Maintenance (étape 5.6) : notifications des tickets.
--
-- Deux cas, tous deux créés par un DÉCLENCHEUR de la base (comme au Lot 4.3 :
-- aucune interface ni aucun navigateur ne peut en fabriquer) :
--   - un nouveau ticket est ouvert : chaque Admin Maintenance et Super-Admin
--     actif est notifié ;
--   - un ticket est affecté (ou réaffecté) à un maintenancier : lui seul est
--     notifié.
-- Les droits de lecture et de « marquer comme lu » sont ceux de la table
-- `notifications` (chacun ne voit que les siennes). Le texte ne contient que le
-- nom de l'équipement et de l'école, jamais la description des pannes.

-- Les deux nouveaux types de notification.
alter table public.notifications
  drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (
    kind in (
      'report_validated',
      'report_corrected',
      'report_to_modify',
      'report_submitted',
      'ticket_created',
      'ticket_assigned'
    )
  );

-- ---------------------------------------------------------------------------
-- Nouveau ticket -> gestion de la maintenance
-- ---------------------------------------------------------------------------
-- Droits du propriétaire (security definer) : personne n'a de droit d'insertion
-- sur `notifications`, c'est la seule porte d'écriture.
create or replace function public.notify_ticket_created()
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
    'ticket_created',
    'Nouvelle panne',
    left(
      new.equipment_label || ' (' || coalesce(v_school, 'école inconnue')
        || ') : un ticket est ouvert.',
      300
    ),
    '/admin/maintenance',
    new.id
  from public.profiles p
  where p.role in ('admin_maintenance', 'super_admin')
    and p.status = 'actif';

  return new;
end;
$$;

revoke all on function public.notify_ticket_created() from public, anon, authenticated;

create trigger maintenance_tickets_notify_created
  after insert on public.maintenance_tickets
  for each row execute function public.notify_ticket_created();

-- ---------------------------------------------------------------------------
-- Ticket affecté -> le maintenancier concerné
-- ---------------------------------------------------------------------------
-- Seulement quand le ticket reçoit un nouveau maintenancier : retirer une
-- affectation ne notifie personne.
create or replace function public.notify_ticket_assigned()
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
  values (
    new.assigned_to,
    'ticket_assigned',
    'Ticket affecté',
    left(
      new.equipment_label || ' (' || coalesce(v_school, 'école inconnue')
        || ') vous est confié.',
      300
    ),
    '/maintenance/tickets/' || new.id::text,
    new.id
  );

  return new;
end;
$$;

revoke all on function public.notify_ticket_assigned() from public, anon, authenticated;

create trigger maintenance_tickets_notify_assigned
  after update of assigned_to on public.maintenance_tickets
  for each row
  when (
    new.assigned_to is not null
    and new.assigned_to is distinct from old.assigned_to
  )
  execute function public.notify_ticket_assigned();
