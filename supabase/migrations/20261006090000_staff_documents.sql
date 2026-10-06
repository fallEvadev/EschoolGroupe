-- Lot 2 — RH (étape 2) : dossier administratif du personnel (CV, CNI, photo…).
-- Règle 4 du CLAUDE.md : bucket privé, URL signées de courte durée,
-- accès réservé à l'Admin RH et au Super-Admin.

-- ---------------------------------------------------------------------------
-- Bucket privé : 5 Mo maximum, PDF et images uniquement
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'staff-documents',
  'staff-documents',
  false,
  5242880,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
);

create policy "staff_documents_storage_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'staff-documents'
    and public.current_user_role() in ('admin_rh', 'super_admin')
  );

create policy "staff_documents_storage_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'staff-documents'
    and public.current_user_role() in ('admin_rh', 'super_admin')
  );

-- Aucune politique update / delete : un fichier envoyé n'est jamais écrasé
-- ni supprimé. Une nouvelle version remplace l'ancienne dans la table.

-- ---------------------------------------------------------------------------
-- staff_documents : une ligne par fichier du dossier
-- ---------------------------------------------------------------------------
create table public.staff_documents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id),
  kind text not null
    check (kind in ('cv', 'cni', 'photo', 'contrat', 'diplome', 'autre')),
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 200),
  mime_type text not null,
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  -- Aucune suppression physique : une nouvelle version passe l'ancienne
  -- en « remplace ».
  status text not null default 'actif'
    check (status in ('actif', 'remplace', 'archive')),
  uploaded_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index staff_documents_profile_idx
  on public.staff_documents (profile_id, kind, status);

create trigger staff_documents_set_updated_at
  before update on public.staff_documents
  for each row execute function public.set_updated_at();

alter table public.staff_documents enable row level security;

create policy "staff_documents_select"
  on public.staff_documents for select to authenticated
  using (public.current_user_role() in ('admin_rh', 'super_admin'));

create policy "staff_documents_insert"
  on public.staff_documents for insert to authenticated
  with check (public.current_user_role() in ('admin_rh', 'super_admin'));

create policy "staff_documents_update"
  on public.staff_documents for update to authenticated
  using (public.current_user_role() in ('admin_rh', 'super_admin'))
  with check (public.current_user_role() in ('admin_rh', 'super_admin'));

revoke all on public.staff_documents from anon;
revoke delete, truncate on public.staff_documents from authenticated;
