-- Incidents : les erreurs de la plateforme, vues par le Super-Admin seulement
-- ---------------------------------------------------------------------------
-- Quand une page, une action ou une route plante, le serveur enregistre un
-- incident (vrai message, chemin de la page, code court). Les erreurs
-- identiques sont regroupées (compteur) et une notification est envoyée au
-- Super-Admin à la première apparition, ou quand un incident déjà résolu
-- revient. Aucune donnée personnelle : ni nom, ni e-mail, ni contenu de rapport
-- (le serveur masque les adresses e-mail avant d'écrire).
--
--   * lecture et suivi : Super-Admin seulement (RLS) ;
--   * écriture d'un incident : uniquement par `record_incident`, appelable avec
--     la clé de service (jamais depuis un navigateur) ;
--   * aucune suppression.

-- ---------------------------------------------------------------------------
-- 1. Nouveau type de notification
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in (
    'report_validated', 'report_corrected', 'report_to_modify',
    'report_submitted', 'ticket_created', 'ticket_assigned',
    'bilan_published', 'incident'
  ));

-- ---------------------------------------------------------------------------
-- 2. Table des incidents
-- ---------------------------------------------------------------------------
create table public.incident_reports (
  id uuid primary key default gen_random_uuid(),
  -- Empreinte du couple (page, type, message) : une même erreur = une ligne.
  fingerprint text not null unique
    check (char_length(fingerprint) between 8 and 128),
  source text not null check (source in ('serveur', 'navigateur')),
  -- Chemin de la page dans l'application, ex. /(formateur)/formateur/cahiers/[attendanceId].
  route_path text not null check (char_length(route_path) between 1 and 300),
  -- Adresse réellement visitée (sans paramètres), ex. /formateur/cahiers/5f0c….
  request_path text check (request_path is null or char_length(request_path) <= 300),
  route_type text check (route_type is null or char_length(route_type) <= 30),
  message text not null check (char_length(message) between 1 and 600),
  digest text check (digest is null or char_length(digest) <= 100),
  stack text check (stack is null or char_length(stack) <= 2500),
  user_role text check (user_role is null or char_length(user_role) <= 40),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  status text not null default 'nouveau'
    check (status in ('nouveau', 'en_cours', 'resolu')),
  occurrences integer not null default 1 check (occurrences >= 1),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text,
  note text check (note is null or char_length(note) <= 500),
  check ((status = 'resolu') = (resolved_at is not null))
);

create index incident_reports_status_seen_idx
  on public.incident_reports (status, last_seen_at desc);

alter table public.incident_reports enable row level security;

create policy "incident_reports_select_super_admin"
  on public.incident_reports for select to authenticated
  using (public.current_user_role() = 'super_admin');

create policy "incident_reports_update_super_admin"
  on public.incident_reports for update to authenticated
  using (public.current_user_role() = 'super_admin')
  with check (public.current_user_role() = 'super_admin');

-- Le Super-Admin ne peut changer que le suivi, jamais le contenu de l'incident.
revoke all on public.incident_reports from public, anon, authenticated;
grant select on public.incident_reports to authenticated;
grant update (status, note, resolved_at, resolved_by)
  on public.incident_reports to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Enregistrer un incident (clé de service seulement)
-- ---------------------------------------------------------------------------
-- Première apparition ou retour d'un incident résolu : une notification pour
-- chaque Super-Admin actif. Une répétition incrémente seulement le compteur
-- (pas de notification : on ne harcèle pas). Plus de 100 nouveaux incidents en
-- une heure : les suivants sont ignorés (protection contre un déluge).
create or replace function public.record_incident(
  p_fingerprint text,
  p_source text,
  p_route_path text,
  p_request_path text,
  p_route_type text,
  p_message text,
  p_digest text,
  p_stack text,
  p_user_role text,
  p_user_agent text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_status text;
  v_notify boolean := false;
begin
  select id, status into v_id, v_status
    from public.incident_reports
    where fingerprint = p_fingerprint
    for update;

  if found then
    update public.incident_reports
      set occurrences = occurrences + 1,
          last_seen_at = now(),
          digest = coalesce(p_digest, digest),
          status = case when status = 'resolu' then 'nouveau' else status end,
          resolved_at = case when status = 'resolu' then null else resolved_at end,
          resolved_by = case when status = 'resolu' then null else resolved_by end
      where id = v_id;
    v_notify := v_status = 'resolu';
  else
    if (select count(*) from public.incident_reports
          where first_seen_at > now() - interval '1 hour') >= 100 then
      return null;
    end if;

    insert into public.incident_reports
      (fingerprint, source, route_path, request_path, route_type, message,
       digest, stack, user_role, user_agent)
      values (
        left(p_fingerprint, 128),
        p_source,
        left(p_route_path, 300),
        left(p_request_path, 300),
        left(p_route_type, 30),
        left(p_message, 600),
        left(p_digest, 100),
        left(p_stack, 2500),
        left(p_user_role, 40),
        left(p_user_agent, 300)
      )
      on conflict (fingerprint) do nothing
      returning id into v_id;
    v_notify := v_id is not null;
  end if;

  if v_notify then
    insert into public.notifications (profile_id, kind, title, body, link, entity_id)
      select
        p.id,
        'incident',
        case when v_status = 'resolu' then 'Incident revenu' else 'Erreur sur la plateforme' end,
        left('Page ' || p_route_path || ' : ' || p_message, 300),
        '/admin/incidents',
        v_id
      from public.profiles p
      where p.role = 'super_admin' and p.status = 'actif';
  end if;

  return v_id;
end;
$$;

revoke all on function public.record_incident(
  text, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.record_incident(
  text, text, text, text, text, text, text, text, text, text
) to service_role;
