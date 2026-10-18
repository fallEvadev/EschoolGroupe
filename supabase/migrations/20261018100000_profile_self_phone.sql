-- Profil : un formateur ou un maintenancier peut changer SON numéro de téléphone.
--
-- La politique de mise à jour de `profiles` est réservée aux RH et au
-- Super-Admin : on n'ouvre pas la table. Comme pour la position d'une école
-- (`set_school_position`), une fonction ne laisse modifier qu'une seule
-- colonne, et seulement sur la fiche de l'appelant. Le rôle, le statut, le
-- nom, l'e-mail et le reste de la fiche restent entre les mains des RH.

create or replace function public.set_my_phone(p_phone text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
begin
  if public.current_clerk_id() is null then
    raise exception 'Connexion requise.' using errcode = '42501';
  end if;

  -- Espaces, points et tirets sont acceptés puis retirés ; vide = effacer le numéro.
  v_phone := nullif(regexp_replace(coalesce(p_phone, ''), '[\s.-]', '', 'g'), '');

  -- Même règle que PHONE_PATTERN dans src/lib/validations/staff.ts :
  -- 9 chiffres commençant par 7 ou 3, avec ou sans +221 / 00221.
  if v_phone is not null and v_phone !~ '^(\+221|00221)?[37][0-9]{8}$' then
    raise exception 'Numéro invalide.' using errcode = '22023';
  end if;

  update public.profiles
    set phone = v_phone
    where clerk_user_id = public.current_clerk_id()
      and status = 'actif'
      and role in ('formateur', 'maintenancier');

  if not found then
    raise exception 'Fiche introuvable ou non autorisée.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.set_my_phone(text) from public, anon;
grant execute on function public.set_my_phone(text) to authenticated;
