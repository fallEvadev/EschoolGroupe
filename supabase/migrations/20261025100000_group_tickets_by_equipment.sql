-- Pannes regroupées par école et par type de matériel.
--
-- Les formateurs signalent « souris », « écran », « unité centrale »… et non une
-- machine numérotée. Désormais, une panne sans machine d'inventaire se rattache
-- au ticket déjà ouvert (ouvert ou en cours) de la MÊME école et du MÊME type
-- (nom comparé sans tenir compte des majuscules) ; sinon un ticket est créé.
-- Une fois le ticket résolu ou archivé, un nouveau signalement ouvre un nouveau
-- ticket. Les pannes d'une machine de l'inventaire gardent leur règle (un ticket
-- ouvert par machine). Seule la fonction change : aucune table ni aucune donnée
-- existante n'est modifiée. La notification « nouveau ticket » ne part qu'à la
-- création, donc un signalement rattaché ne prévient personne de plus.

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
    -- rapport ; sinon la panne est traitée comme un matériel désigné par son type.
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

    v_ticket_id := null;
    if v_machine_id is not null then
      -- Ticket ouvert de cette machine : on s'y rattache.
      select t.id into v_ticket_id
        from public.maintenance_tickets t
        where t.machine_id = v_machine_id and t.status in ('ouvert', 'en_cours');
    else
      -- Matériel désigné par son type : un seul ticket ouvert par école et par
      -- type. Le verrou évite que deux rapports envoyés en même temps ouvrent
      -- chacun un ticket.
      perform pg_advisory_xact_lock(
        hashtextextended(new.school_id::text || '|' || lower(v_label), 0)
      );
      select t.id into v_ticket_id
        from public.maintenance_tickets t
        where t.school_id = new.school_id
          and t.machine_id is null
          and lower(t.equipment_label) = lower(v_label)
          and t.status in ('ouvert', 'en_cours')
        order by t.opened_at
        limit 1;
    end if;

    -- Sinon, nouveau ticket. Pour une machine, si un autre envoi vient d'en
    -- ouvrir un (index unique), on se rattache à celui-là.
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
