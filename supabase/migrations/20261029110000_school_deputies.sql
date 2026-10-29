-- Adjoints de directeur partenaire.
--
-- Un directeur peut inviter lui-même des adjoints pour SON école (au plus 2) afin
-- que les codes ne dépendent pas d'une seule personne. Un adjoint est un compte
-- « directeur partenaire » comme les autres : il voit le code, les bilans et la
-- cloche de l'école. Il ne peut ni inviter d'autres adjoints, ni enregistrer la
-- position de l'école.
--
-- Le directeur n'a aucun droit d'écriture sur `profiles` ni sur `school_directors` :
-- tout passe par des fonctions `security definer` qui contrôlent l'appelant.
-- Rien n'est supprimé : retirer un adjoint archive son rattachement.

-- ---------------------------------------------------------------------------
-- 1. Qui est adjoint, et qui l'a invité
-- ---------------------------------------------------------------------------
alter table public.school_directors
  add column is_deputy boolean not null default false,
  add column invited_by uuid references public.profiles (id);

alter table public.school_directors
  add constraint school_directors_deputy_check
  check ((is_deputy and invited_by is not null) or (not is_deputy and invited_by is null));

-- ---------------------------------------------------------------------------
-- 2. Inviter un adjoint (crée la fiche « invité » et le rattachement)
-- ---------------------------------------------------------------------------
-- L'invitation Clerk (e-mail) est envoyée ensuite par le serveur.
create or replace function public.invite_deputy(
  p_school_id uuid,
  p_full_name text,
  p_email text,
  p_phone text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := public.current_profile_id();
  v_name text := regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_new uuid;
begin
  -- L'appelant doit être directeur principal ACTIF de cette école (pas un adjoint).
  if v_me is null or not exists (
    select 1
    from public.school_directors d
    join public.schools s on s.id = d.school_id
    join public.profiles p on p.id = d.profile_id
    where d.school_id = p_school_id
      and d.profile_id = v_me
      and d.status = 'actif'
      and d.is_deputy = false
      and s.status = 'actif'
      and p.status = 'actif'
      and p.role = 'directeur_partenaire'
  ) then
    raise exception 'Seul le directeur de cette école peut inviter un adjoint.'
      using errcode = '42501';
  end if;

  if char_length(v_name) < 3 or char_length(v_name) > 120 or position(' ' in v_name) = 0 then
    raise exception 'Indiquez le prénom puis le nom de l''adjoint.' using errcode = '22023';
  end if;
  if char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Adresse e-mail invalide.' using errcode = '22023';
  end if;
  if v_phone is not null and char_length(v_phone) > 20 then
    raise exception 'Numéro de téléphone invalide.' using errcode = '22023';
  end if;

  -- Deux invitations simultanées ne doivent pas dépasser la limite.
  perform pg_advisory_xact_lock(hashtextextended('deputy:' || p_school_id::text, 0));

  if (
    select count(*) from public.school_directors
    where school_id = p_school_id and is_deputy and status = 'actif'
  ) >= 2 then
    raise exception 'Cette école a déjà 2 adjoints. Retirez-en un avant d''en inviter un autre.'
      using errcode = '23514';
  end if;

  -- L'adresse e-mail est unique (violation 23505 si une fiche existe déjà).
  insert into public.profiles (email, full_name, phone, role, status, created_by)
  values (v_email, v_name, v_phone, 'directeur_partenaire', 'invite', public.current_clerk_id())
  returning id into v_new;

  insert into public.school_directors (school_id, profile_id, is_deputy, invited_by)
  values (p_school_id, v_new, true, v_me);

  return v_new;
end;
$$;

revoke all on function public.invite_deputy(uuid, text, text, text) from public, anon;
grant execute on function public.invite_deputy(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Retirer un adjoint (archive le rattachement ; rien n'est supprimé)
-- ---------------------------------------------------------------------------
-- Renvoie l'identifiant de l'invitation encore en attente, pour que le serveur
-- la révoque chez Clerk ; `null` si l'adjoint avait déjà activé son compte.
create or replace function public.remove_deputy(
  p_school_id uuid,
  p_profile_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := public.current_profile_id();
  v_status text;
  v_invitation text;
begin
  if v_me is null or not exists (
    select 1
    from public.school_directors d
    join public.profiles p on p.id = d.profile_id
    where d.school_id = p_school_id
      and d.profile_id = v_me
      and d.status = 'actif'
      and d.is_deputy = false
      and p.status = 'actif'
      and p.role = 'directeur_partenaire'
  ) then
    raise exception 'Seul le directeur de cette école peut retirer un adjoint.'
      using errcode = '42501';
  end if;

  update public.school_directors
    set status = 'archive'
    where school_id = p_school_id
      and profile_id = p_profile_id
      and is_deputy
      and status = 'actif';
  if not found then
    raise exception 'Cet adjoint n''existe pas ou a déjà été retiré.' using errcode = 'P0002';
  end if;

  -- Une invitation jamais activée : la fiche est archivée avec elle.
  select status, invitation_id into v_status, v_invitation
    from public.profiles where id = p_profile_id;
  if v_status = 'invite' then
    update public.profiles set status = 'archive' where id = p_profile_id;
    return v_invitation;
  end if;
  return null;
end;
$$;

revoke all on function public.remove_deputy(uuid, uuid) from public, anon;
grant execute on function public.remove_deputy(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Lire ses adjoints (le directeur ne lit jamais la table des personnes)
-- ---------------------------------------------------------------------------
create or replace function public.my_deputies()
returns table (
  school_id uuid,
  profile_id uuid,
  full_name text,
  profile_status text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select d.school_id, d.profile_id, p.full_name, p.status, d.created_at
  from public.school_directors d
  join public.profiles p on p.id = d.profile_id
  where d.is_deputy
    and d.status = 'actif'
    and exists (
      select 1
      from public.school_directors me
      join public.profiles mp on mp.id = me.profile_id
      where me.school_id = d.school_id
        and me.profile_id = public.current_profile_id()
        and me.status = 'actif'
        and me.is_deputy = false
        and mp.status = 'actif'
        and mp.role = 'directeur_partenaire'
    )
  order by d.created_at;
$$;

revoke all on function public.my_deputies() from public, anon;
grant execute on function public.my_deputies() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Un adjoint n'enregistre pas la position de l'école
-- ---------------------------------------------------------------------------
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
      and d.is_deputy = false
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

-- ---------------------------------------------------------------------------
-- 6. La Direction pédagogique est prévenue de chaque invitation
-- ---------------------------------------------------------------------------
alter table public.notifications
  drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in (
    'report_validated', 'report_corrected', 'report_to_modify',
    'report_submitted', 'ticket_created', 'ticket_assigned',
    'bilan_published', 'incident', 'ticket_received', 'code_ready',
    'deputy_invited'
  ));

create or replace function public.notify_deputy_invited()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school text;
  v_name text;
begin
  select name into v_school from public.schools where id = new.school_id;
  select full_name into v_name from public.profiles where id = new.profile_id;

  insert into public.notifications (profile_id, kind, title, body, link, entity_id)
  select
    p.id,
    'deputy_invited',
    'Adjoint invité',
    left(
      'Le directeur de ' || coalesce(v_school, 'une école') || ' a invité un adjoint : '
        || coalesce(v_name, 'sans nom') || '.',
      300
    ),
    '/admin/ecoles',
    new.school_id
  from public.profiles p
  where p.role in ('admin_pedagogie', 'super_admin')
    and p.status = 'actif';

  return new;
end;
$$;

revoke all on function public.notify_deputy_invited() from public, anon, authenticated;

create trigger school_directors_notify_deputy
  after insert on public.school_directors
  for each row
  when (new.is_deputy)
  execute function public.notify_deputy_invited();
