-- Descente validée par la Direction : heure réelle de départ
-- ---------------------------------------------------------------------------
-- Quand un formateur part avant la fin du créneau (par exemple à 12h pour un
-- cours de 8h à 13h), le code du directeur n'est accepté qu'à la fin exacte du
-- créneau : la Direction valide donc la descente elle-même. Jusqu'ici l'heure
-- retenue était toujours la fin du créneau.
--
-- Nouveau : un paramètre FACULTATIF `p_departed_time` (heure de Dakar, « HH:MM »)
-- pour enregistrer l'heure réelle. Sans lui, rien ne change.
-- Règles de l'heure : après l'arrivée du formateur, pas après la fin du
-- créneau, pas dans le futur. Le motif reste obligatoire.

drop function public.set_departure_by_direction(uuid, text);

create or replace function public.set_departure_by_direction(
  p_attendance_id uuid,
  p_reason text,
  p_departed_time time default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_att public.attendances%rowtype;
  v_ends time;
  v_end_moment timestamptz;
  v_moment timestamptz;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not public.is_pedagogy_manager() then
    raise exception 'Action réservée à la Direction pédagogique.'
      using errcode = '42501';
  end if;
  if char_length(v_reason) not between 3 and 300 then
    raise exception 'Le motif doit faire entre 3 et 300 caractères.'
      using errcode = '22023';
  end if;

  select * into v_att from public.attendances where id = p_attendance_id for update;
  if not found then
    raise exception 'Pointage introuvable.' using errcode = 'P0002';
  end if;
  if not v_att.requires_departure then
    raise exception 'Ce pointage n''a pas de descente à valider.'
      using errcode = '23514';
  end if;
  if v_att.departed_at is not null then
    raise exception 'La descente est déjà validée.' using errcode = '23514';
  end if;

  select ends_at into v_ends from public.time_slots where id = v_att.slot_id;
  v_end_moment := ((v_att.attendance_date + v_ends) at time zone 'Africa/Dakar');

  if p_departed_time is null then
    -- Heure retenue : la fin du créneau (jamais dans le futur).
    v_moment := least(now(), v_end_moment);
  else
    v_moment := ((v_att.attendance_date + p_departed_time) at time zone 'Africa/Dakar');
    if v_moment <= v_att.recorded_at then
      raise exception 'L''heure de départ doit être après l''arrivée du formateur (%).',
        to_char(v_att.recorded_at at time zone 'Africa/Dakar', 'HH24:MI')
        using errcode = '22023';
    end if;
    if v_moment > v_end_moment then
      raise exception 'L''heure de départ ne peut pas dépasser la fin du créneau (%).',
        to_char(v_ends, 'HH24:MI')
        using errcode = '22023';
    end if;
    if v_moment > now() then
      raise exception 'L''heure de départ ne peut pas être dans le futur.'
        using errcode = '22023';
    end if;
  end if;

  update public.attendances
    set departed_at = v_moment,
        departure_source = 'direction',
        departure_reason = v_reason
    where id = p_attendance_id;
end;
$$;

revoke all on function public.set_departure_by_direction(uuid, text, time)
  from public, anon;
grant execute on function public.set_departure_by_direction(uuid, text, time)
  to authenticated;
