-- Code du jour prêt : les directeurs de l'école sont prévenus.
--
-- Quand la Direction génère les codes du jour (un clic pour toutes les écoles),
-- chaque directeur ACTIF rattaché à l'école reçoit une notification. Le texte
-- ne contient JAMAIS le code : le directeur ne le voit sur son espace qu'à la
-- fin du premier cours (voir partner_codes_today).
--
-- Créée par un déclencheur de la base, comme les autres notifications : aucun
-- navigateur ne peut en fabriquer.

alter table public.notifications
  drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in (
    'report_validated', 'report_corrected', 'report_to_modify',
    'report_submitted', 'ticket_created', 'ticket_assigned',
    'bilan_published', 'incident', 'ticket_received', 'code_ready'
  ));

create or replace function public.notify_code_ready()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school text;
begin
  -- Une régénération le même jour (code divulgué, par exemple) ne prévient
  -- personne une seconde fois : seul le premier code du jour de l'école compte.
  if exists (
    select 1
    from public.daily_codes c
    where c.school_id = new.school_id
      and c.code_date = new.code_date
      and c.id <> new.id
  ) then
    return new;
  end if;

  select name into v_school from public.schools where id = new.school_id;

  insert into public.notifications (profile_id, kind, title, body, link, entity_id)
  select
    p.id,
    'code_ready',
    'Code du jour prêt',
    left(
      'Le code de descente du jour de ' || coalesce(v_school, 'votre école')
        || ' est prêt. Vous le verrez ici à la fin du premier cours.',
      300
    ),
    '/partenaire',
    new.school_id
  from public.school_directors d
  join public.profiles p on p.id = d.profile_id
  where d.school_id = new.school_id
    and d.status = 'actif'
    and p.status = 'actif'
    and p.role = 'directeur_partenaire';

  return new;
end;
$$;

revoke all on function public.notify_code_ready() from public, anon, authenticated;

create trigger daily_codes_notify_ready
  after insert on public.daily_codes
  for each row
  when (new.status = 'actif')
  execute function public.notify_code_ready();
