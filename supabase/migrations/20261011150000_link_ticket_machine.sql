-- Lot 5 — Maintenance (étape 5.5b) : rattacher un « Autre équipement » à une
-- machine de l'inventaire.
--
-- Un formateur qui ne trouve pas sa machine dans la liste signale un « Autre
-- équipement » : le ticket n'a alors pas de machine. L'Admin Maintenance le
-- rattache ensuite à la bonne machine de l'école.
--   - Si la machine n'a pas de ticket ouvert : le ticket prend cette machine.
--   - Si la machine a déjà un ticket ouvert : les deux sont fusionnés. Les
--     signalements passent dans le ticket existant, et le ticket « Autre
--     équipement » est archivé (rien n'est supprimé).
--
-- Les signalements (`ticket_reports`) ne sont PAS réécrits quand le ticket prend
-- une machine : ils gardent leur nom d'origine. C'est ce qui évite de recréer un
-- ticket si le même rapport est renvoyé avec le même « Autre équipement ».

create or replace function public.link_ticket_to_machine(
  p_ticket_id uuid,
  p_machine_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.maintenance_tickets%rowtype;
  v_machine public.machines%rowtype;
  v_target uuid;
begin
  if not public.is_maintenance_manager() then
    raise exception 'Action réservée à l''Admin Maintenance.'
      using errcode = '42501';
  end if;

  select * into v_ticket
    from public.maintenance_tickets
    where id = p_ticket_id
    for update;
  if not found then
    raise exception 'Ticket introuvable.' using errcode = 'P0002';
  end if;
  if v_ticket.machine_id is not null then
    raise exception 'Ce ticket est déjà rattaché à une machine.'
      using errcode = '23514';
  end if;
  if v_ticket.status not in ('ouvert', 'en_cours') then
    raise exception 'Seul un ticket ouvert ou en cours peut être rattaché.'
      using errcode = '23514';
  end if;

  select * into v_machine from public.machines where id = p_machine_id;
  if not found then
    raise exception 'Machine introuvable.' using errcode = 'P0002';
  end if;
  if v_machine.school_id <> v_ticket.school_id then
    raise exception 'Cette machine n''appartient pas à l''école du ticket.'
      using errcode = '23514';
  end if;
  if v_machine.status <> 'actif' then
    raise exception 'Cette machine est archivée.' using errcode = '23514';
  end if;

  -- Un ticket ouvert existe déjà pour cette machine ?
  select id into v_target
    from public.maintenance_tickets
    where machine_id = p_machine_id and status in ('ouvert', 'en_cours')
    for update;

  if v_target is null then
    begin
      update public.maintenance_tickets
        set machine_id = p_machine_id, equipment_label = left(v_machine.label, 80)
        where id = p_ticket_id;
    exception when unique_violation then
      -- Un autre envoi vient d'ouvrir un ticket pour cette machine.
      raise exception 'Un ticket vient d''être ouvert pour cette machine : réessayez.'
        using errcode = '23514';
    end;
    return 'rattache';
  end if;

  -- Fusion : les signalements rejoignent le ticket existant, le ticket
  -- « Autre équipement » est archivé avec une note qui explique pourquoi.
  update public.ticket_reports set ticket_id = v_target where ticket_id = p_ticket_id;
  update public.maintenance_tickets
    set status = 'archive',
        resolution_note = 'Fusionné avec le ticket de la machine ' || v_machine.label || '.'
    where id = p_ticket_id;
  return 'fusionne';
end;
$$;

revoke all on function public.link_ticket_to_machine(uuid, uuid) from public, anon;
grant execute on function public.link_ticket_to_machine(uuid, uuid) to authenticated;
