-- Lot 3 — Pointage (étape 4) : transmission du code aux directeurs partenaires.
--
-- La Direction pédagogique envoie chaque code au directeur de l'école par un
-- lien WhatsApp déjà rempli : il lui faut le numéro du directeur. La RLS de
-- `profiles` ne lui permet pas de le lire (e-mail, téléphone et documents sont
-- réservés aux RH). On étend donc l'annuaire minimal avec le téléphone, mais
-- UNIQUEMENT pour les directeurs partenaires : jamais celui des formateurs.

-- Le type de retour change : la fonction doit être recréée.
drop function if exists public.pedagogy_staff_directory();

create function public.pedagogy_staff_directory()
returns table (
  id uuid,
  full_name text,
  role public.user_role,
  status text,
  phone text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.full_name,
    p.role,
    p.status,
    -- Téléphone des directeurs seulement ; vide pour les formateurs.
    case when p.role = 'directeur_partenaire' then p.phone end
  from public.profiles p
  where public.is_pedagogy_manager()
    and p.role in ('formateur', 'directeur_partenaire')
$$;

revoke all on function public.pedagogy_staff_directory() from public, anon;
grant execute on function public.pedagogy_staff_directory() to authenticated;
