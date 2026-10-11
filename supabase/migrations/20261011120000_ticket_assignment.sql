-- Lot 5 — Maintenance (étape 5.5) : affectation des tickets à un maintenancier.
-- Aucune nouvelle table : la colonne `assigned_to` existe déjà (5.3). Cette
-- migration ajoute l'annuaire minimal dont l'Admin Maintenance a besoin et un
-- garde-fou d'intégrité sur l'affectation.

-- ---------------------------------------------------------------------------
-- Annuaire minimal pour l'Admin Maintenance : nom, rôle et statut des
-- maintenanciers (pour affecter) et des formateurs (pour savoir qui a signalé
-- une panne). La RLS de `profiles` ne lui permet pas de lire ces fiches (e-mail,
-- téléphone, documents sont réservés aux RH) : cette fonction n'expose ni
-- téléphone, ni e-mail, ni document.
-- ---------------------------------------------------------------------------
create or replace function public.maintenance_team_directory()
returns table (
  id uuid,
  full_name text,
  role public.user_role,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.role, p.status
  from public.profiles p
  where public.is_maintenance_manager()
    and p.role in ('maintenancier', 'formateur')
$$;

revoke all on function public.maintenance_team_directory() from public, anon;
grant execute on function public.maintenance_team_directory() to authenticated;

-- ---------------------------------------------------------------------------
-- Garde-fou : seul un maintenancier actif peut se voir affecter un ticket, et
-- un ticket résolu ou archivé ne change plus d'affectation (même si
-- l'application se trompe).
-- ---------------------------------------------------------------------------
create or replace function public.guard_ticket_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assigned_to is not null
     and new.assigned_to is distinct from old.assigned_to then
    if not exists (
      select 1 from public.profiles
      where id = new.assigned_to
        and role = 'maintenancier'
        and status = 'actif'
    ) then
      raise exception 'Seul un maintenancier actif peut être affecté à un ticket.'
        using errcode = '23514';
    end if;
  end if;

  if new.assigned_to is distinct from old.assigned_to
     and new.status in ('resolu', 'archive') then
    raise exception 'Un ticket résolu ou archivé ne change plus d''affectation.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger maintenance_tickets_guard_assignment
  before update of assigned_to on public.maintenance_tickets
  for each row execute function public.guard_ticket_assignment();
