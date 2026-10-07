-- Lot 3 — Programme mensuel : un PDF publié chaque mois par la Direction
-- pédagogique, consultable par les formateurs.
--
-- Bucket privé réservé aux PDF (10 Mo). Écriture : Admin Pédagogie et
-- Super-Admin, avec leur propre jeton. Lecture : les formateurs (version en
-- vigueur seulement) et la Direction (toutes les versions). Aucune
-- suppression : un nouveau programme pour le même mois remplace l'ancien, qui
-- est conservé.

-- ---------------------------------------------------------------------------
-- Bucket privé : 10 Mo maximum, PDF uniquement
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'monthly-programs',
  'monthly-programs',
  false,
  10485760,
  array['application/pdf']
);

-- ---------------------------------------------------------------------------
-- monthly_programs : un PDF par mois (une version en vigueur)
-- ---------------------------------------------------------------------------
create table public.monthly_programs (
  id uuid primary key default gen_random_uuid(),
  -- Premier jour du mois concerné (2026-10-01 pour octobre 2026).
  program_month date not null
    check (program_month = date_trunc('month', program_month)::date),
  title text not null check (char_length(title) between 3 and 150),
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 200),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  -- Aucune suppression : un programme remplacé passe en « remplace ».
  status text not null default 'actif' check (status in ('actif', 'remplace')),
  published_by text not null,
  published_at timestamptz not null default now()
);

-- Un seul programme en vigueur par mois.
create unique index monthly_programs_active_month_unique
  on public.monthly_programs (program_month) where status = 'actif';

alter table public.monthly_programs enable row level security;

-- Lecture : la Direction voit toutes les versions ; un formateur seulement
-- celle en vigueur.
create policy "monthly_programs_select"
  on public.monthly_programs for select to authenticated
  using (
    public.is_pedagogy_manager()
    or (public.current_user_role() = 'formateur' and status = 'actif')
  );

create policy "monthly_programs_insert"
  on public.monthly_programs for insert to authenticated
  with check (
    public.is_pedagogy_manager()
    and published_by = public.current_clerk_id()
  );

create policy "monthly_programs_update"
  on public.monthly_programs for update to authenticated
  using (public.is_pedagogy_manager())
  with check (public.is_pedagogy_manager());

revoke all on public.monthly_programs from anon;
revoke delete, truncate on public.monthly_programs from authenticated;

-- ---------------------------------------------------------------------------
-- Stockage : mêmes droits que la table
-- ---------------------------------------------------------------------------
-- Un formateur ne lit que le fichier d'un programme en vigueur, même s'il
-- connaît le chemin d'une ancienne version.
create policy "monthly_programs_storage_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'monthly-programs'
    and (
      public.is_pedagogy_manager()
      or (
        public.current_user_role() = 'formateur'
        and exists (
          select 1 from public.monthly_programs p
          where p.storage_path = storage.objects.name
            and p.status = 'actif'
        )
      )
    )
  );

create policy "monthly_programs_storage_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'monthly-programs'
    and public.is_pedagogy_manager()
  );

-- Aucune politique update / delete : un fichier envoyé n'est jamais écrasé
-- ni supprimé.

-- ---------------------------------------------------------------------------
-- replace_monthly_program : publie un programme, en une seule transaction
-- ---------------------------------------------------------------------------
-- L'ancien programme en vigueur du mois passe en « remplace » et le nouveau est
-- inséré. Si l'insertion échoue, tout est annulé : l'ancien reste en vigueur.
-- La fonction s'exécute avec les droits de l'appelant : la RLS s'applique.
create or replace function public.replace_monthly_program(
  p_month date,
  p_title text,
  p_storage_path text,
  p_file_name text,
  p_size_bytes integer
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  update public.monthly_programs
    set status = 'remplace'
    where program_month = p_month and status = 'actif';

  insert into public.monthly_programs (
    program_month, title, storage_path, file_name, size_bytes, published_by
  )
  values (
    p_month, p_title, p_storage_path, p_file_name, p_size_bytes,
    public.current_clerk_id()
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.replace_monthly_program(date, text, text, text, integer)
  from public, anon;
grant execute on function public.replace_monthly_program(date, text, text, text, integer)
  to authenticated;
