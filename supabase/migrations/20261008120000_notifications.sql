-- Lot 4 — Rapports journaliers (étape 3) : notifications dans l'application.
--
-- Deux cas, tous deux créés par un DÉCLENCHEUR de la base (aucune interface ni
-- aucun navigateur ne peut en fabriquer) :
--   - la Direction rend sa décision sur un rapport (validé, validé avec
--     corrections, à modifier) : le formateur est notifié ;
--   - un formateur envoie ou renvoie un rapport : la Direction pédagogique
--     (Admin Pédagogie et Super-Admin actifs) est notifiée.
-- Chacun lit les siennes et peut seulement les marquer comme lues. Aucune
-- suppression physique.
--
-- Le texte ne contient pas le commentaire de la Direction ni le contenu du
-- rapport (ils peuvent être sensibles) : on les lit en ouvrant le rapport.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id),
  kind text not null
    check (
      kind in (
        'report_validated',
        'report_corrected',
        'report_to_modify',
        'report_submitted'
      )
    ),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) <= 300),
  -- Chemin interne de l'application (jamais une adresse externe).
  link text check (link is null or link ~ '^/[A-Za-z0-9/_-]*$'),
  -- Rapport (ou autre objet) concerné.
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_profile_idx
  on public.notifications (profile_id, created_at desc);
create index notifications_unread_idx
  on public.notifications (profile_id) where read_at is null;

alter table public.notifications enable row level security;

-- Chacun ne voit que ses notifications.
create policy "notifications_select_own"
  on public.notifications for select to authenticated
  using (profile_id = public.current_profile_id());

-- Chacun ne peut que marquer les siennes comme lues (seule colonne autorisée).
create policy "notifications_update_own"
  on public.notifications for update to authenticated
  using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

revoke all on public.notifications from anon;
revoke insert, update, delete, truncate on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- Déclencheur : décision de la Direction -> notification du formateur
-- ---------------------------------------------------------------------------
-- Droits du propriétaire (security definer) car le formateur n'a aucun droit
-- d'insertion : c'est la seule porte d'écriture. Se déclenche seulement quand
-- un rapport « soumis » reçoit une décision.
create or replace function public.notify_report_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school text;
  v_day text := to_char(new.report_date, 'DD/MM/YYYY');
begin
  select name into v_school from public.schools where id = new.school_id;
  v_school := coalesce(v_school, 'votre école');

  insert into public.notifications (profile_id, kind, title, body, link, entity_id)
  values (
    new.profile_id,
    case new.status
      when 'valide' then 'report_validated'
      when 'valide_avec_corrections' then 'report_corrected'
      else 'report_to_modify'
    end,
    case new.status
      when 'valide' then 'Rapport validé'
      when 'valide_avec_corrections' then 'Rapport validé avec corrections'
      else 'Rapport à modifier'
    end,
    case new.status
      when 'valide' then
        'Votre rapport du ' || v_day || ' (' || v_school || ') a été validé.'
      when 'valide_avec_corrections' then
        'Votre rapport du ' || v_day || ' (' || v_school
          || ') a été validé avec des corrections de la Direction.'
      else
        'La Direction demande une modification de votre rapport du ' || v_day
          || ' (' || v_school || '). Ouvrez-le pour lire le commentaire.'
    end,
    '/formateur/cahiers/' || new.attendance_id::text,
    new.id
  );

  return new;
end;
$$;

revoke all on function public.notify_report_decision() from public, anon, authenticated;

create trigger daily_reports_notify_decision
  after update of status on public.daily_reports
  for each row
  when (
    old.status = 'soumis'
    and new.status in ('valide', 'valide_avec_corrections', 'a_modifier')
  )
  execute function public.notify_report_decision();

-- ---------------------------------------------------------------------------
-- Déclencheur : rapport envoyé -> notification de la Direction pédagogique
-- ---------------------------------------------------------------------------
-- Un rapport qui passe à « soumis » (premier envoi, ou renvoi après une demande
-- de modification) prévient chaque Admin Pédagogie et Super-Admin actif. Droits
-- du propriétaire : le formateur n'a aucun droit d'insertion ni de lecture sur
-- les profils de la Direction.
create or replace function public.notify_report_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school text;
  v_name text;
  v_day text := to_char(new.report_date, 'DD/MM/YYYY');
  v_resubmitted boolean := old.status = 'a_modifier';
begin
  select name into v_school from public.schools where id = new.school_id;
  select full_name into v_name from public.profiles where id = new.profile_id;

  insert into public.notifications (profile_id, kind, title, body, link, entity_id)
  select
    p.id,
    'report_submitted',
    case when v_resubmitted then 'Rapport renvoyé' else 'Nouveau rapport' end,
    case when v_resubmitted then 'Rapport corrigé' else 'Rapport' end
      || ' de ' || coalesce(v_name, 'un formateur')
      || ' du ' || v_day
      || ' (' || coalesce(v_school, 'école inconnue') || ') à traiter.',
    '/admin/rapports',
    new.id
  from public.profiles p
  where p.role in ('admin_pedagogie', 'super_admin')
    and p.status = 'actif';

  return new;
end;
$$;

revoke all on function public.notify_report_submitted() from public, anon, authenticated;

create trigger daily_reports_notify_submitted
  after update of status on public.daily_reports
  for each row
  when (
    old.status in ('brouillon', 'a_modifier')
    and new.status = 'soumis'
  )
  execute function public.notify_report_submitted();
