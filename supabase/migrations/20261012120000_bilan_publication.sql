-- Lot 6 — Bilans (étape 6.4) : PDF final et publication d'un bilan.
--
-- Après avoir relu le Word, la Direction dépose le PDF FINAL du bilan, puis le
-- publie. Un bilan publié est figé : plus de rapport ajouté, plus de PDF
-- remplacé. Aucune suppression physique : remplacer le PDF d'un brouillon envoie
-- un nouveau fichier et change le chemin mémorisé, l'ancien reste dans le
-- stockage.
--
-- Cette étape ne rend pas encore le bilan visible par l'école (portail en 6.5,
-- e-mail en 6.6).

-- ---------------------------------------------------------------------------
-- Bucket privé : 10 Mo maximum, PDF uniquement
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bilans', 'bilans', false, 10485760, array['application/pdf']);

-- ---------------------------------------------------------------------------
-- Colonnes du PDF final et de la publication
-- ---------------------------------------------------------------------------
alter table public.bilans
  add column pdf_path text,
  add column pdf_file_name text
    check (pdf_file_name is null or char_length(pdf_file_name) between 1 and 200),
  add column pdf_size_bytes integer
    check (pdf_size_bytes is null or pdf_size_bytes between 1 and 10485760),
  add column pdf_uploaded_at timestamptz,
  add column published_at timestamptz,
  add column published_by text;

-- Les informations du PDF vont ensemble : toutes présentes ou toutes absentes.
alter table public.bilans
  add constraint bilans_pdf_complete check (
    (pdf_path is null) = (pdf_file_name is null)
    and (pdf_path is null) = (pdf_size_bytes is null)
    and (pdf_path is null) = (pdf_uploaded_at is null)
  ),
  -- Le chemin a la forme « <id du bilan>/<uuid>-<nom sûr> » : un bilan ne peut
  -- pas pointer vers le fichier d'un autre.
  add constraint bilans_pdf_path_format check (
    pdf_path is null
    or pdf_path ~ (
      '^' || id::text
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[A-Za-z0-9._-]{1,80}$'
    )
  ),
  -- Publié si et seulement si une date de publication existe, et jamais sans PDF.
  add constraint bilans_published_complete check (
    (status = 'publie') = (published_at is not null)
    and (status <> 'publie' or pdf_path is not null)
  );

-- ---------------------------------------------------------------------------
-- Garde-fou : un bilan publié est entièrement figé
-- ---------------------------------------------------------------------------
create or replace function public.guard_bilan()
returns trigger
language plpgsql
as $$
begin
  if new.school_id <> old.school_id
     or new.period_kind <> old.period_kind
     or new.period_start <> old.period_start
     or new.period_end <> old.period_end then
    raise exception 'L''école et la période d''un bilan ne se modifient pas.'
      using errcode = '23514';
  end if;
  if old.status = 'publie' and new.status <> 'publie' then
    raise exception 'Un bilan publié ne redevient pas brouillon.'
      using errcode = '23514';
  end if;
  if old.status = 'publie' and (
       new.pdf_path is distinct from old.pdf_path
       or new.pdf_file_name is distinct from old.pdf_file_name
       or new.pdf_size_bytes is distinct from old.pdf_size_bytes
       or new.pdf_uploaded_at is distinct from old.pdf_uploaded_at
       or new.published_at is distinct from old.published_at
       or new.published_by is distinct from old.published_by
     ) then
    raise exception 'Un bilan publié est figé.' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Stockage : la Direction pédagogique envoie et lit les PDF
-- ---------------------------------------------------------------------------
-- Le directeur partenaire lira les PDF publiés de son école (étape 6.5).
create policy "bilans_storage_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'bilans' and public.is_pedagogy_manager());

create policy "bilans_storage_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'bilans' and public.is_pedagogy_manager());

-- Aucune politique update / delete : un fichier envoyé n'est jamais écrasé
-- ni supprimé.

-- ---------------------------------------------------------------------------
-- attach_bilan_pdf : rattache le PDF final déposé à un bilan en brouillon
-- ---------------------------------------------------------------------------
-- Droits de l'appelant : la RLS et les garde-fous s'appliquent. Remplace le PDF
-- précédent du brouillon (qui reste dans le stockage).
create or replace function public.attach_bilan_pdf(
  p_bilan_id uuid,
  p_path text,
  p_file_name text,
  p_size integer
)
returns void
language plpgsql
as $$
declare
  v_bilan public.bilans%rowtype;
begin
  if not public.is_pedagogy_manager() then
    raise exception 'Action réservée à la Direction pédagogique.'
      using errcode = '42501';
  end if;

  select * into v_bilan from public.bilans where id = p_bilan_id for update;
  if not found then
    raise exception 'Bilan introuvable.' using errcode = 'P0002';
  end if;
  if v_bilan.status <> 'brouillon' then
    raise exception 'Un bilan publié est figé.' using errcode = '23514';
  end if;

  update public.bilans
    set pdf_path = p_path,
        pdf_file_name = p_file_name,
        pdf_size_bytes = p_size,
        pdf_uploaded_at = now()
    where id = p_bilan_id;
end;
$$;

revoke all on function public.attach_bilan_pdf(uuid, text, text, integer) from public, anon;
grant execute on function public.attach_bilan_pdf(uuid, text, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- publish_bilan : publie un bilan (brouillon avec PDF -> publié, figé)
-- ---------------------------------------------------------------------------
create or replace function public.publish_bilan(p_bilan_id uuid)
returns void
language plpgsql
as $$
declare
  v_bilan public.bilans%rowtype;
begin
  if not public.is_pedagogy_manager() then
    raise exception 'Action réservée à la Direction pédagogique.'
      using errcode = '42501';
  end if;

  select * into v_bilan from public.bilans where id = p_bilan_id for update;
  if not found then
    raise exception 'Bilan introuvable.' using errcode = 'P0002';
  end if;
  if v_bilan.status = 'publie' then
    raise exception 'Ce bilan est déjà publié.' using errcode = '23514';
  end if;
  if v_bilan.pdf_path is null then
    raise exception 'Déposez d''abord le PDF final.' using errcode = '23514';
  end if;

  update public.bilans
    set status = 'publie',
        published_at = now(),
        published_by = public.current_clerk_id()
    where id = p_bilan_id;
end;
$$;

revoke all on function public.publish_bilan(uuid) from public, anon;
grant execute on function public.publish_bilan(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- generate_bilans : si des rapports s'ajoutent à un brouillon qui a déjà un PDF,
-- ce PDF ne correspond plus au contenu : il est détaché (le fichier reste dans le
-- stockage) et la fonction l'indique, pour que la Direction régénère le Word
-- puis redépose le PDF.
-- ---------------------------------------------------------------------------
drop function public.generate_bilans(text, date);

create or replace function public.generate_bilans(p_kind text, p_start date)
returns table (
  out_school_id uuid,
  out_bilan_id uuid,
  out_report_count integer,
  out_outcome text,
  out_pdf_reset boolean
)
language plpgsql
as $$
declare
  v_end date;
  v_school uuid;
  v_bilan public.bilans%rowtype;
  v_outcome text;
  v_added integer;
  v_reset boolean;
begin
  if not public.is_pedagogy_manager() then
    raise exception 'Action réservée à la Direction pédagogique.'
      using errcode = '42501';
  end if;

  if p_kind = 'semaine' then
    if extract(isodow from p_start) <> 1 then
      raise exception 'Une semaine commence un lundi.' using errcode = '23514';
    end if;
    v_end := p_start + 6;
  elsif p_kind = 'mois' then
    if extract(day from p_start) <> 1 then
      raise exception 'Un mois commence le 1er.' using errcode = '23514';
    end if;
    v_end := (p_start + interval '1 month - 1 day')::date;
  else
    raise exception 'Période invalide.' using errcode = '23514';
  end if;

  for v_school in
    select distinct r.school_id
    from public.daily_reports r
    where r.status in ('valide', 'valide_avec_corrections')
      and r.report_date between p_start and v_end
    order by 1
  loop
    v_added := 0;
    v_reset := false;

    select * into v_bilan
      from public.bilans b
      where b.school_id = v_school
        and b.period_kind = p_kind
        and b.period_start = p_start
      for update;

    if not found then
      insert into public.bilans (school_id, period_kind, period_start, period_end, generated_by)
        values (v_school, p_kind, p_start, v_end, public.current_clerk_id())
        returning * into v_bilan;
      v_outcome := 'cree';
    elsif v_bilan.status <> 'brouillon' then
      v_outcome := 'ignore';
    else
      update public.bilans
        set generated_at = now(), generated_by = public.current_clerk_id()
        where id = v_bilan.id;
      v_outcome := 'actualise';
    end if;

    if v_outcome <> 'ignore' then
      insert into public.bilan_reports (bilan_id, report_id)
        select v_bilan.id, r.id
        from public.daily_reports r
        where r.school_id = v_school
          and r.status in ('valide', 'valide_avec_corrections')
          and r.report_date between p_start and v_end
        on conflict do nothing;
      get diagnostics v_added = row_count;

      -- Des rapports en plus : l'ancien PDF est périmé, on le détache.
      if v_added > 0 and v_bilan.pdf_path is not null then
        update public.bilans
          set pdf_path = null,
              pdf_file_name = null,
              pdf_size_bytes = null,
              pdf_uploaded_at = null
          where id = v_bilan.id;
        v_reset := true;
      end if;
    end if;

    out_school_id := v_school;
    out_bilan_id := v_bilan.id;
    select count(*)::integer into out_report_count
      from public.bilan_reports br where br.bilan_id = v_bilan.id;
    out_outcome := v_outcome;
    out_pdf_reset := v_reset;
    return next;
  end loop;
end;
$$;

revoke all on function public.generate_bilans(text, date) from public, anon;
grant execute on function public.generate_bilans(text, date) to authenticated;
