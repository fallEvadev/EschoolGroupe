-- Le maintenancier voit toutes les pannes ouvertes et peut les prendre en charge
-- ---------------------------------------------------------------------------
-- Avant : un maintenancier ne lisait que les tickets que l'Admin Maintenance lui
-- affectait. Il ne pouvait donc pas savoir quelles écoles avaient des pannes.
--
-- Maintenant :
--   * il lit tous les tickets OUVERTS ou EN COURS (toutes écoles), et l'historique
--     de ceux qui lui ont été affectés ;
--   * il peut prendre en charge ou résoudre un ticket NON AFFECTÉ : le ticket lui
--     est alors affecté ; un ticket confié à un collègue reste à ce collègue
--     (seule la gestion de la maintenance peut le réaffecter) ;
--   * il est prévenu à chaque nouvelle panne.
-- Les noms des formateurs restent invisibles : rien ne change pour eux.

-- ---------------------------------------------------------------------------
-- 1. Lecture des tickets
-- ---------------------------------------------------------------------------
-- `ticket_reports_select` suit celle-ci (elle lit les tickets visibles).
drop policy "maintenance_tickets_select" on public.maintenance_tickets;

create policy "maintenance_tickets_select"
  on public.maintenance_tickets for select to authenticated
  using (
    public.is_maintenance_manager()
    or (
      public.current_user_role() = 'maintenancier'
      and (
        assigned_to = public.current_profile_id()
        or status in ('ouvert', 'en_cours')
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Prendre en charge un ticket
-- ---------------------------------------------------------------------------
create or replace function public.start_ticket(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.maintenance_tickets%rowtype;
  v_manager boolean := public.is_maintenance_manager();
  v_me uuid := public.current_profile_id();
begin
  select * into v_ticket
    from public.maintenance_tickets
    where id = p_ticket_id
    for update;

  if not found then
    raise exception 'Ticket introuvable.' using errcode = 'P0002';
  end if;

  if not v_manager then
    if public.current_user_role() <> 'maintenancier' or v_me is null then
      raise exception 'Action réservée à la maintenance.' using errcode = '42501';
    end if;
    if v_ticket.assigned_to is not null and v_ticket.assigned_to <> v_me then
      raise exception 'Ce ticket est confié à un autre maintenancier.'
        using errcode = '42501';
    end if;
  end if;

  if v_ticket.status <> 'ouvert' then
    raise exception 'Ce ticket n''est plus à prendre en charge.'
      using errcode = '23514';
  end if;

  update public.maintenance_tickets
    set status = 'en_cours',
        started_at = now(),
        -- Un maintenancier qui prend un ticket libre se l'affecte.
        assigned_to = case
          when not v_manager and assigned_to is null then v_me
          else assigned_to
        end
    where id = p_ticket_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Résoudre un ticket
-- ---------------------------------------------------------------------------
create or replace function public.resolve_ticket(p_ticket_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.maintenance_tickets%rowtype;
  v_manager boolean := public.is_maintenance_manager();
  v_me uuid := public.current_profile_id();
  v_note text := btrim(coalesce(p_note, ''));
begin
  select * into v_ticket
    from public.maintenance_tickets
    where id = p_ticket_id
    for update;

  if not found then
    raise exception 'Ticket introuvable.' using errcode = 'P0002';
  end if;

  if not v_manager then
    if public.current_user_role() <> 'maintenancier' or v_me is null then
      raise exception 'Action réservée à la maintenance.' using errcode = '42501';
    end if;
    if v_ticket.assigned_to is not null and v_ticket.assigned_to <> v_me then
      raise exception 'Ce ticket est confié à un autre maintenancier.'
        using errcode = '42501';
    end if;
  end if;

  if v_ticket.status not in ('ouvert', 'en_cours') then
    raise exception 'Ce ticket est déjà résolu ou archivé.'
      using errcode = '23514';
  end if;

  if char_length(v_note) < 3 or char_length(v_note) > 500 then
    raise exception 'Décrivez l''intervention (entre 3 et 500 caractères).'
      using errcode = '23514';
  end if;

  -- L'affectation change avant le statut : le garde-fou d'affectation interdit
  -- de changer l'affectation d'un ticket déjà résolu.
  if not v_manager and v_ticket.assigned_to is null then
    update public.maintenance_tickets
      set assigned_to = v_me
      where id = p_ticket_id;
  end if;

  update public.maintenance_tickets
    set status = 'resolu',
        resolved_at = now(),
        started_at = coalesce(started_at, now()),
        resolution_note = v_note
    where id = p_ticket_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Notifications
-- ---------------------------------------------------------------------------
-- Un maintenancier qui prend lui-même un ticket ne se notifie pas.
create or replace function public.notify_ticket_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school text;
begin
  if new.assigned_to = public.current_profile_id() then
    return new;
  end if;

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

-- Nouvelle panne : la gestion de la maintenance ET les maintenanciers actifs.
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
    case
      when p.role = 'maintenancier' then '/maintenance/tickets/' || new.id::text
      else '/admin/maintenance'
    end,
    new.id
  from public.profiles p
  where p.role in ('admin_maintenance', 'super_admin', 'maintenancier')
    and p.status = 'actif';

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. « Bien reçu » : le formateur qui a signalé la panne est prévenu
-- ---------------------------------------------------------------------------
-- Quand la maintenance prend un ticket en charge (ouvert -> en cours), chaque
-- formateur ACTIF qui a signalé cette panne reçoit une notification qui renvoie
-- vers son rapport. Une seule notification par formateur, même s'il a signalé
-- la panne plusieurs jours de suite. Le texte ne reprend ni la description de la
-- panne ni le nom du maintenancier.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in (
    'report_validated', 'report_corrected', 'report_to_modify',
    'report_submitted', 'ticket_created', 'ticket_assigned',
    'bilan_published', 'incident', 'ticket_received'
  ));

create or replace function public.notify_ticket_received()
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
  select distinct on (r.reported_by)
    r.reported_by,
    'ticket_received',
    'Panne bien reçue',
    left(
      'La maintenance a bien reçu votre signalement : ' || new.equipment_label
        || ' (' || coalesce(v_school, 'école inconnue') || ').',
      300
    ),
    '/formateur/cahiers/' || d.attendance_id::text,
    new.id
  from public.ticket_reports r
  join public.daily_reports d on d.id = r.report_id
  join public.profiles p on p.id = r.reported_by and p.status = 'actif'
  where r.ticket_id = new.id
  order by r.reported_by, r.reported_at desc;

  return new;
end;
$$;

create trigger maintenance_tickets_notify_received
  after update of status on public.maintenance_tickets
  for each row
  when (old.status = 'ouvert' and new.status = 'en_cours')
  execute function public.notify_ticket_received();
