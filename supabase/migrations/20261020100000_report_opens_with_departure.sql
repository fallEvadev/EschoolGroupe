-- Le rapport journalier s'ouvre avec la descente
-- ---------------------------------------------------------------------------
-- Avant : le formulaire s'ouvrait 10 minutes avant la fin du cours.
-- Maintenant : le formateur ne peut CRÉER son rapport qu'une fois sa descente
-- validée (`attendances.departed_at` renseigné) : soit par le code que le
-- directeur lui donne après le cours, soit par la Direction pédagogique si le
-- directeur est absent (`set_departure_by_direction`).
--
-- Seule la création est bloquée : un brouillon qui existe déjà (écrit sous
-- l'ancienne règle) reste modifiable et envoyable. La Direction n'est pas
-- concernée, et les anciens pointages (`requires_departure` faux) non plus.

create or replace function public.guard_report_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_att record;
begin
  if public.is_pedagogy_manager() then
    return new;
  end if;

  -- Un rapport déjà créé reste modifiable : seul son démarrage est conditionné.
  if tg_op <> 'INSERT' then
    return new;
  end if;

  select a.requires_departure, a.departed_at
    into v_att
    from public.attendances a
    where a.id = new.attendance_id;
  if not found or not v_att.requires_departure then
    return new;
  end if;

  if v_att.departed_at is null then
    raise exception 'Le rapport s''ouvre quand la descente est validée.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function public.guard_report_window() is
  'Le formateur ne crée son rapport qu''après la validation de sa descente (code du directeur ou Direction pédagogique).';
