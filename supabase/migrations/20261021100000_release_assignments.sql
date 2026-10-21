-- Libérer les affectations quand une personne ne peut plus les tenir
-- ---------------------------------------------------------------------------
-- Problème : changer le rôle d'une personne, ou la désactiver, laissait ses
-- affectations de créneaux (formateur) et ses rattachements d'école (directeur)
-- actifs. L'écran des pointages reconstruit les absences depuis les affectations
-- actives : il comptait donc des absences pour des gens qui n'enseignent plus.
--
-- Règle : une affectation de créneau n'est active que pour un formateur dont le
-- compte n'est ni désactivé ni archivé ; un rattachement d'école n'est actif que
-- pour un directeur partenaire dans le même cas. Dans les autres cas elles sont
-- ARCHIVÉES (jamais supprimées) : l'historique des absences reste juste, car il
-- s'arrête à la date d'archivage (`updated_at`).
--
-- Une réactivation ne restaure rien : la Direction réaffecte explicitement.
-- Une personne « invitée » (pas encore activée) garde ses affectations : on peut
-- préparer son planning avant son premier accès.

create or replace function public.release_assignments_on_profile_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_left_formateur boolean := old.role = 'formateur' and new.role <> 'formateur';
  v_left_director boolean := old.role = 'directeur_partenaire'
                             and new.role <> 'directeur_partenaire';
  v_closed boolean := new.status in ('inactif', 'archive')
                      and old.status is distinct from new.status;
begin
  if v_left_formateur or v_closed then
    update public.slot_assignments
      set status = 'archive'
      where profile_id = new.id and status = 'actif';
  end if;

  if v_left_director or v_closed then
    update public.school_directors
      set status = 'archive'
      where profile_id = new.id and status = 'actif';
  end if;

  return new;
end;
$$;

create trigger profiles_release_assignments
  after update of role, status on public.profiles
  for each row execute function public.release_assignments_on_profile_change();

-- ---------------------------------------------------------------------------
-- Nettoyage des données existantes (le déclencheur n'agit que sur l'avenir)
-- ---------------------------------------------------------------------------
update public.slot_assignments sa
  set status = 'archive'
  from public.profiles p
  where p.id = sa.profile_id
    and sa.status = 'actif'
    and (p.role <> 'formateur' or p.status in ('inactif', 'archive'));

update public.school_directors d
  set status = 'archive'
  from public.profiles p
  where p.id = d.profile_id
    and d.status = 'actif'
    and (p.role <> 'directeur_partenaire' or p.status in ('inactif', 'archive'));
