-- Lot 6 — Bilans (étape 6.5) : le directeur partenaire consulte les bilans
-- PUBLIÉS de SON école, en lecture seule.
--
-- Choix de conception : la table `bilans` n'est PAS ouverte au directeur (elle
-- contient des identifiants internes, les brouillons, les chemins de stockage).
-- Il passe par des fonctions qui ne renvoient que le strict nécessaire, et
-- seulement pour les écoles auxquelles il est rattaché (school_directors) et les
-- bilans publiés qui ont leur PDF final. Aucune suppression physique.

-- ---------------------------------------------------------------------------
-- partner_bilans : les bilans publiés des écoles de l'appelant
-- ---------------------------------------------------------------------------
create or replace function public.partner_bilans()
returns table (
  out_id uuid,
  out_school_id uuid,
  out_school_name text,
  out_period_kind text,
  out_period_start date,
  out_period_end date,
  out_published_at timestamptz,
  out_pdf_file_name text,
  out_pdf_size_bytes integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id, b.school_id, s.name, b.period_kind, b.period_start, b.period_end,
    b.published_at, b.pdf_file_name, b.pdf_size_bytes
  from public.bilans b
  join public.schools s on s.id = b.school_id
  where b.status = 'publie'
    and b.pdf_path is not null
    and exists (
      select 1 from public.school_directors d
      where d.school_id = b.school_id
        and d.status = 'actif'
        and d.profile_id = public.current_profile_id()
    )
  order by b.period_start desc, s.name
$$;

revoke all on function public.partner_bilans() from public, anon;
grant execute on function public.partner_bilans() to authenticated;

-- ---------------------------------------------------------------------------
-- partner_bilan_file : chemin et nom du PDF d'un bilan que l'appelant peut lire
-- ---------------------------------------------------------------------------
-- Même condition que ci-dessus : publié, avec PDF, et école de l'appelant. Vide
-- sinon (un bilan brouillon ou d'une autre école ne se distingue pas d'un bilan
-- inexistant).
create or replace function public.partner_bilan_file(p_bilan_id uuid)
returns table (out_path text, out_file_name text)
language sql
stable
security definer
set search_path = public
as $$
  select b.pdf_path, b.pdf_file_name
  from public.bilans b
  where b.id = p_bilan_id
    and b.status = 'publie'
    and b.pdf_path is not null
    and exists (
      select 1 from public.school_directors d
      where d.school_id = b.school_id
        and d.status = 'actif'
        and d.profile_id = public.current_profile_id()
    )
$$;

revoke all on function public.partner_bilan_file(uuid) from public, anon;
grant execute on function public.partner_bilan_file(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Stockage : le directeur lit le PDF d'un bilan publié de son école
-- ---------------------------------------------------------------------------
-- La fonction (droits du propriétaire) lit `bilans` à la place du directeur, qui
-- n'y a pas accès. Elle ne répond « oui » que pour un fichier précis.
create or replace function public.can_read_bilan_pdf(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bilans b
    where b.pdf_path = p_path
      and b.status = 'publie'
      and exists (
        select 1 from public.school_directors d
        where d.school_id = b.school_id
          and d.status = 'actif'
          and d.profile_id = public.current_profile_id()
      )
  )
$$;

revoke all on function public.can_read_bilan_pdf(text) from public, anon;
grant execute on function public.can_read_bilan_pdf(text) to authenticated;

create policy "bilans_storage_select_directors"
  on storage.objects for select to authenticated
  using (bucket_id = 'bilans' and public.can_read_bilan_pdf(name));

-- ---------------------------------------------------------------------------
-- Notification : un bilan est publié -> les directeurs de l'école
-- ---------------------------------------------------------------------------
alter table public.notifications
  drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (
    kind in (
      'report_validated',
      'report_corrected',
      'report_to_modify',
      'report_submitted',
      'ticket_created',
      'ticket_assigned',
      'bilan_published'
    )
  );

-- Créée par un déclencheur de la base (comme les autres notifications) : aucune
-- interface ni aucun navigateur ne peut en fabriquer. Le texte ne contient que
-- l'école et la période.
create or replace function public.notify_bilan_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school text;
begin
  select name into v_school from public.schools where id = new.school_id;

  insert into public.notifications (profile_id, kind, title, body, link, entity_id)
  select
    p.id,
    'bilan_published',
    'Nouveau bilan',
    left(
      'Le bilan du ' || to_char(new.period_start, 'DD/MM/YYYY')
        || ' au ' || to_char(new.period_end, 'DD/MM/YYYY')
        || ' de ' || coalesce(v_school, 'votre école') || ' est disponible.',
      300
    ),
    '/partenaire/bilans',
    new.id
  from public.school_directors d
  join public.profiles p on p.id = d.profile_id
  where d.school_id = new.school_id
    and d.status = 'actif'
    and p.status = 'actif';

  return new;
end;
$$;

revoke all on function public.notify_bilan_published() from public, anon, authenticated;

create trigger bilans_notify_published
  after update of status on public.bilans
  for each row
  when (old.status <> 'publie' and new.status = 'publie')
  execute function public.notify_bilan_published();
