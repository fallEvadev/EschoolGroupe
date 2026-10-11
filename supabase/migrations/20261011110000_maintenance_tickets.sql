-- Lot 5 — Maintenance (étape 5.3) : tickets de pannes créés à l'envoi du rapport.
--
-- Règles :
-- * chaque panne d'un rapport envoyé crée un ticket, sauf si la machine a déjà
--   un ticket ouvert : la panne s'ajoute alors à ce ticket (un « signalement ») ;
-- * « Autre équipement » (hors inventaire) crée toujours son propre ticket ;
-- * renvoyer un rapport (après « à modifier ») ne recrée jamais un ticket déjà
--   compté pour ce rapport ;
-- * les corrections de la Direction ne touchent pas aux tickets ;
-- * les rapports d'avant le Lot 5 ne génèrent aucun ticket.
-- Aucune suppression physique. RLS dans cette même migration.

-- ---------------------------------------------------------------------------
-- maintenance_tickets : une panne à traiter
-- ---------------------------------------------------------------------------
create table public.maintenance_tickets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id),
  -- Vide pour « Autre équipement » (hors inventaire).
  machine_id uuid references public.machines (id),
  -- Nom de l'équipement à l'ouverture du ticket (reste lisible si renommé).
  equipment_label text not null check (char_length(equipment_label) between 1 and 80),
  status text not null default 'ouvert'
    check (status in ('ouvert', 'en_cours', 'resolu', 'archive')),
  -- Maintenancier chargé du ticket (affectation en 5.5).
  assigned_to uuid references public.profiles (id),
  opened_at timestamptz not null default now(),
  started_at timestamptz,
  resolved_at timestamptz,
  resolution_note text
    check (resolution_note is null or char_length(resolution_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Une machine n'a qu'un ticket ouvert à la fois : c'est ce qui rattache les doublons.
create unique index maintenance_tickets_one_open_per_machine
  on public.maintenance_tickets (machine_id)
  where machine_id is not null and status in ('ouvert', 'en_cours');

create index maintenance_tickets_status_idx
  on public.maintenance_tickets (status, opened_at desc);
create index maintenance_tickets_school_idx
  on public.maintenance_tickets (school_id);
create index maintenance_tickets_assigned_idx
  on public.maintenance_tickets (assigned_to) where assigned_to is not null;

create trigger maintenance_tickets_set_updated_at
  before update on public.maintenance_tickets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- ticket_reports : les signalements (panne décrite dans un rapport) d'un ticket
-- ---------------------------------------------------------------------------
create table public.ticket_reports (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.maintenance_tickets (id),
  report_id uuid not null references public.daily_reports (id),
  machine_id uuid references public.machines (id),
  equipment_label text not null check (char_length(equipment_label) between 1 and 80),
  description text not null check (char_length(description) between 1 and 300),
  -- Le formateur qui a signalé la panne.
  reported_by uuid not null references public.profiles (id),
  reported_at timestamptz not null default now()
);

-- Une machine n'est comptée qu'une fois par rapport (renvoi sans doublon).
create unique index ticket_reports_report_machine_unique
  on public.ticket_reports (report_id, machine_id) where machine_id is not null;
-- Idem pour un équipement hors inventaire, reconnu par son nom.
create unique index ticket_reports_report_label_unique
  on public.ticket_reports (report_id, lower(equipment_label))
  where machine_id is null;

create index ticket_reports_ticket_idx
  on public.ticket_reports (ticket_id, reported_at desc);

-- ---------------------------------------------------------------------------
-- Création des tickets à l'envoi d'un rapport
-- ---------------------------------------------------------------------------
-- Déclencheur « security definer » : le formateur n'a aucun droit d'écriture
-- sur les tickets, seul ce déclencheur les crée (même principe que les
-- notifications). Il s'exécute dans la transaction de l'envoi : si la création
-- échoue, le rapport n'est pas envoyé non plus.
create or replace function public.create_tickets_for_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_issue jsonb;
  v_machine_id uuid;
  v_machine_label text;
  v_label text;
  v_description text;
  v_ticket_id uuid;
begin
  for v_issue in select value from jsonb_array_elements(new.equipment_issues)
  loop
    v_label := left(btrim(coalesce(v_issue ->> 'equipment', '')), 80);
    v_description := left(btrim(coalesce(v_issue ->> 'description', '')), 300);

    -- Machine de l'inventaire ? Elle doit exister et appartenir à l'école du
    -- rapport ; sinon la panne est traitée comme « Autre équipement ».
    v_machine_id := null;
    begin
      v_machine_id := nullif(v_issue ->> 'machineId', '')::uuid;
    exception when invalid_text_representation then
      v_machine_id := null;
    end;
    if v_machine_id is not null then
      select m.label into v_machine_label
        from public.machines m
        where m.id = v_machine_id and m.school_id = new.school_id;
      if found then
        v_label := left(v_machine_label, 80);
      else
        v_machine_id := null;
      end if;
    end if;

    -- Ligne incomplète : la validation de l'application l'empêche déjà.
    if v_label = '' or v_description = '' then
      continue;
    end if;

    -- Déjà compté pour ce rapport (renvoi après « à modifier ») : on passe.
    if exists (
      select 1 from public.ticket_reports tr
      where tr.report_id = new.id
        and (
          (v_machine_id is not null and tr.machine_id = v_machine_id)
          or (
            v_machine_id is null
            and tr.machine_id is null
            and lower(tr.equipment_label) = lower(v_label)
          )
        )
    ) then
      continue;
    end if;

    -- Ticket ouvert de cette machine : on s'y rattache.
    v_ticket_id := null;
    if v_machine_id is not null then
      select t.id into v_ticket_id
        from public.maintenance_tickets t
        where t.machine_id = v_machine_id and t.status in ('ouvert', 'en_cours');
    end if;

    -- Sinon, nouveau ticket. Si un autre envoi vient d'en ouvrir un pour la
    -- même machine (index unique), on se rattache à celui-là.
    if v_ticket_id is null then
      begin
        insert into public.maintenance_tickets (school_id, machine_id, equipment_label)
          values (new.school_id, v_machine_id, v_label)
          returning id into v_ticket_id;
      exception when unique_violation then
        select t.id into v_ticket_id
          from public.maintenance_tickets t
          where t.machine_id = v_machine_id and t.status in ('ouvert', 'en_cours');
      end;
    end if;

    insert into public.ticket_reports
      (ticket_id, report_id, machine_id, equipment_label, description, reported_by)
      values
      (v_ticket_id, new.id, v_machine_id, v_label, v_description, new.profile_id);
  end loop;

  return new;
end;
$$;

revoke all on function public.create_tickets_for_report() from public, anon, authenticated;

-- Seulement au passage à « soumis » (premier envoi ou renvoi), jamais à une
-- décision de la Direction.
create trigger daily_reports_create_tickets
  after update of status on public.daily_reports
  for each row
  when (old.status in ('brouillon', 'a_modifier') and new.status = 'soumis')
  execute function public.create_tickets_for_report();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.maintenance_tickets enable row level security;
alter table public.ticket_reports enable row level security;

-- Lecture : l'Admin Maintenance et le Super-Admin voient tout ; un
-- maintenancier voit les tickets qui lui sont affectés.
create policy "maintenance_tickets_select"
  on public.maintenance_tickets for select to authenticated
  using (
    public.is_maintenance_manager()
    or (
      public.current_user_role() = 'maintenancier'
      and assigned_to = public.current_profile_id()
    )
  );

-- Mise à jour : la gestion de la maintenance (le travail du maintenancier sur
-- ses tickets arrive en 5.4, par une fonction qui limite les champs).
create policy "maintenance_tickets_update"
  on public.maintenance_tickets for update to authenticated
  using (public.is_maintenance_manager())
  with check (public.is_maintenance_manager());

-- Signalements : visibles avec leur ticket (la RLS du ticket s'applique).
create policy "ticket_reports_select"
  on public.ticket_reports for select to authenticated
  using (
    exists (
      select 1 from public.maintenance_tickets t where t.id = ticket_reports.ticket_id
    )
  );

-- Pas d'insertion directe (seul le déclencheur écrit), pas de suppression,
-- rien pour les visiteurs anonymes. Les signalements ne se modifient pas.
revoke all on public.maintenance_tickets, public.ticket_reports from anon;
revoke insert, delete, truncate on public.maintenance_tickets from authenticated;
revoke insert, update, delete, truncate on public.ticket_reports from authenticated;
