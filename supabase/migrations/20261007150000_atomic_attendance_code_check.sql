-- Sécurité (revue du Lot 3) : la limite des essais de code devient atomique.
--
-- Avant : le serveur lisait les échecs, comparait le code, puis écrivait
-- l'échec en trois étapes séparées. Des requêtes simultanées voyaient toutes
-- « 0 échec » et obtenaient chacune un essai avant le blocage.
--
-- Maintenant : une seule fonction, dans une seule transaction, verrouille le
-- formateur, compte ses échecs récents, compare le code et enregistre le
-- résultat. Une requête simultanée attend son tour et voit les échecs des
-- précédentes.
--
-- Règle (mêmes valeurs que src/lib/attendance.ts) : 5 codes faux dans les 15
-- dernières minutes bloquent le pointage jusqu'à ce que le plus ancien de ces
-- échecs sorte de la fenêtre. Une demande pendant le blocage n'est pas
-- comptée : elle ne prolonge pas le blocage.

create or replace function public.verify_attendance_code(
  p_profile_id uuid,
  p_school_id uuid,
  p_code_date date,
  p_code text
)
returns table (outcome text, remaining integer, minutes_left integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max constant integer := 5;
  v_window constant interval := interval '15 minutes';
  v_failures timestamptz[];
  v_count integer;
  v_unlock timestamptz;
  v_expected text;
begin
  -- Un seul contrôle à la fois pour ce formateur. Le verrou tient jusqu'à la
  -- fin de la transaction, donc jusqu'à l'enregistrement du résultat.
  perform pg_advisory_xact_lock(hashtextextended(p_profile_id::text, 0));

  select coalesce(array_agg(attempted_at order by attempted_at), '{}')
    into v_failures
    from public.attendance_attempts
    where profile_id = p_profile_id
      and not succeeded
      and attempted_at > now() - v_window;
  v_count := coalesce(cardinality(v_failures), 0);

  -- Bloqué : on ne compte pas la demande, on dit quand réessayer.
  if v_count >= v_max then
    v_unlock := v_failures[v_count - v_max + 1] + v_window;
    return query select
      'locked'::text,
      0,
      greatest(1, ceil(extract(epoch from (v_unlock - now())) / 60))::integer;
    return;
  end if;

  select code into v_expected
    from public.daily_codes
    where school_id = p_school_id
      and code_date = p_code_date
      and status = 'actif';

  -- Pas de code généré : ce n'est pas la faute du formateur, rien n'est compté.
  if v_expected is null then
    return query select 'no_code'::text, v_max - v_count, 0;
    return;
  end if;

  if v_expected <> p_code then
    insert into public.attendance_attempts (profile_id, school_id, succeeded)
      values (p_profile_id, p_school_id, false);
    return query select 'wrong'::text, v_max - v_count - 1, 0;
    return;
  end if;

  insert into public.attendance_attempts (profile_id, school_id, succeeded)
    values (p_profile_id, p_school_id, true);
  return query select 'ok'::text, v_max - v_count, 0;
end;
$$;

-- Réservée au serveur (clé de service). Elle prend un identifiant de fiche en
-- argument : un utilisateur connecté ne doit jamais pouvoir l'appeler, sinon il
-- pourrait tester des codes ou bloquer les autres formateurs.
revoke all on function public.verify_attendance_code(uuid, uuid, date, text)
  from public, anon, authenticated;
grant execute on function public.verify_attendance_code(uuid, uuid, date, text)
  to service_role;
