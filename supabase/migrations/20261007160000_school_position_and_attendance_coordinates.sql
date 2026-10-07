-- Pointage : la position de l'école n'est plus saisie par l'administrateur.
--
-- Le directeur partenaire, qui est sur place, l'enregistre une fois depuis son
-- téléphone. L'administrateur garde une saisie manuelle de secours. Le rayon
-- (colonne `radius_m`, 150 m par défaut) n'est plus modifiable dans
-- l'interface mais reste en base : AUCUNE colonne ni donnée n'est supprimée.
--
-- Le pointage conserve désormais les coordonnées GPS du formateur, en plus de
-- la distance et de la précision. Ce sont des données personnelles : elles
-- restent lisibles par le formateur concerné et la Direction pédagogique
-- seulement (politique `attendances_select`, inchangée).

-- ---------------------------------------------------------------------------
-- schools : qui a défini la position, quand, avec quelle précision
-- ---------------------------------------------------------------------------
alter table public.schools
  add column position_source text
    check (position_source in ('directeur', 'admin')),
  add column position_set_at timestamptz,
  add column position_set_by text,
  add column position_accuracy_m integer
    check (position_accuracy_m is null or position_accuracy_m >= 0);

-- ---------------------------------------------------------------------------
-- attendances : coordonnées du formateur au moment du pointage
-- ---------------------------------------------------------------------------
alter table public.attendances
  add column latitude double precision
    check (latitude between -90 and 90),
  add column longitude double precision
    check (longitude between -180 and 180),
  add constraint attendances_coordinates_together
    check ((latitude is null) = (longitude is null));

-- ---------------------------------------------------------------------------
-- set_school_position : le directeur enregistre la position de SON école
-- ---------------------------------------------------------------------------
-- Les directeurs n'ont pas le droit de modifier `schools` (nom, tolérance…) :
-- cette fonction ne leur ouvre que la position, et seulement pour une école à
-- laquelle ils sont rattachés. Elle s'exécute avec les droits du propriétaire
-- (security definer) mais contrôle l'appelant elle-même.
create or replace function public.set_school_position(
  p_school_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.school_directors d
    join public.schools s on s.id = d.school_id
    where d.school_id = p_school_id
      and d.profile_id = public.current_profile_id()
      and d.status = 'actif'
      and s.status = 'actif'
  ) then
    raise exception 'Vous n''êtes pas directeur de cette école.'
      using errcode = '42501';
  end if;

  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90
     or p_longitude not between -180 and 180 then
    raise exception 'Coordonnées invalides.' using errcode = '22023';
  end if;

  -- Même seuil que MAX_SCHOOL_POSITION_ACCURACY_M dans src/lib/attendance.ts :
  -- une position trop imprécise ne doit pas devenir la référence de l'école.
  if p_accuracy_m is null or p_accuracy_m < 0 or p_accuracy_m > 100 then
    raise exception 'Position trop imprécise.' using errcode = '22023';
  end if;

  update public.schools
    set latitude = p_latitude,
        longitude = p_longitude,
        position_source = 'directeur',
        position_set_at = now(),
        position_set_by = public.current_clerk_id(),
        position_accuracy_m = p_accuracy_m
    where id = p_school_id;
end;
$$;

revoke all on function public.set_school_position(uuid, double precision, double precision, integer)
  from public, anon;
grant execute on function public.set_school_position(uuid, double precision, double precision, integer)
  to authenticated;
