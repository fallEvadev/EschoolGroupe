-- Lot 5 — Maintenance (étape 5.4) : le maintenancier traite ses tickets.
--
-- Le maintenancier n'a aucun droit de modification direct sur les tickets (la
-- politique de mise à jour est réservée à la gestion de la maintenance). Il
-- passe par ces deux fonctions, qui ne laissent bouger que le statut, les
-- dates et la note de résolution : jamais l'affectation ni l'école.
--
-- Elles sont « security definer » : le contrôle du droit (ticket affecté à
-- l'appelant, ou gestionnaire de la maintenance) est fait ici, à la main.

-- ---------------------------------------------------------------------------
-- start_ticket : prendre en charge un ticket (ouvert -> en cours)
-- ---------------------------------------------------------------------------
create or replace function public.start_ticket(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.maintenance_tickets%rowtype;
begin
  select * into v_ticket
    from public.maintenance_tickets
    where id = p_ticket_id
    for update;

  if not found then
    raise exception 'Ticket introuvable.' using errcode = 'P0002';
  end if;

  if not (
    public.is_maintenance_manager()
    or (
      public.current_user_role() = 'maintenancier'
      and v_ticket.assigned_to = public.current_profile_id()
    )
  ) then
    raise exception 'Ce ticket ne vous est pas affecté.' using errcode = '42501';
  end if;

  if v_ticket.status <> 'ouvert' then
    raise exception 'Ce ticket n''est plus à prendre en charge.'
      using errcode = '23514';
  end if;

  update public.maintenance_tickets
    set status = 'en_cours', started_at = now()
    where id = p_ticket_id;
end;
$$;

revoke all on function public.start_ticket(uuid) from public, anon;
grant execute on function public.start_ticket(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- resolve_ticket : marquer un ticket résolu, avec une note d'intervention
-- (ouvert ou en cours -> résolu). La note est obligatoire.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_ticket(p_ticket_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.maintenance_tickets%rowtype;
  v_note text := btrim(coalesce(p_note, ''));
begin
  select * into v_ticket
    from public.maintenance_tickets
    where id = p_ticket_id
    for update;

  if not found then
    raise exception 'Ticket introuvable.' using errcode = 'P0002';
  end if;

  if not (
    public.is_maintenance_manager()
    or (
      public.current_user_role() = 'maintenancier'
      and v_ticket.assigned_to = public.current_profile_id()
    )
  ) then
    raise exception 'Ce ticket ne vous est pas affecté.' using errcode = '42501';
  end if;

  if v_ticket.status not in ('ouvert', 'en_cours') then
    raise exception 'Ce ticket est déjà résolu ou archivé.'
      using errcode = '23514';
  end if;

  if char_length(v_note) < 3 or char_length(v_note) > 500 then
    raise exception 'Décrivez l''intervention (entre 3 et 500 caractères).'
      using errcode = '23514';
  end if;

  update public.maintenance_tickets
    set status = 'resolu',
        resolved_at = now(),
        started_at = coalesce(started_at, now()),
        resolution_note = v_note
    where id = p_ticket_id;
end;
$$;

revoke all on function public.resolve_ticket(uuid, text) from public, anon;
grant execute on function public.resolve_ticket(uuid, text) to authenticated;
