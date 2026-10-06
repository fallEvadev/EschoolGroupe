-- Lot 2 — RH (étape 4) : règlement intérieur versionné et acceptations.
-- Une version publiée n'est jamais modifiée ni supprimée : pour changer le
-- règlement, on publie une nouvelle version, que chacun doit ré-accepter.

-- ---------------------------------------------------------------------------
-- internal_rules : une ligne par version publiée
-- ---------------------------------------------------------------------------
create table public.internal_rules (
  id uuid primary key default gen_random_uuid(),
  -- Numéro attribué par la base : 1, 2, 3… (jamais deux fois le même).
  version integer generated always as identity unique,
  title text not null check (char_length(title) between 3 and 150),
  content text not null check (char_length(content) between 20 and 50000),
  published_by text,
  published_at timestamptz not null default now()
);

alter table public.internal_rules enable row level security;

-- Lecture : tout utilisateur connecté (il faut pouvoir lire pour accepter).
create policy "internal_rules_select"
  on public.internal_rules for select to authenticated
  using (true);

-- Publication : Admin RH et Super-Admin, au nom de l'utilisateur connecté.
create policy "internal_rules_insert"
  on public.internal_rules for insert to authenticated
  with check (
    public.current_user_role() in ('admin_rh', 'super_admin')
    and published_by = public.current_clerk_id()
  );

-- Pas de modification ni de suppression, et rien pour les visiteurs anonymes.
revoke all on public.internal_rules from anon;
revoke update, delete, truncate on public.internal_rules from authenticated;

-- ---------------------------------------------------------------------------
-- document_acceptances : qui a accepté quelle version, et quand
-- ---------------------------------------------------------------------------
create table public.document_acceptances (
  id uuid primary key default gen_random_uuid(),
  rules_id uuid not null references public.internal_rules (id),
  profile_id uuid not null references public.profiles (id),
  accepted_at timestamptz not null default now(),
  -- Une seule acceptation par personne et par version.
  unique (rules_id, profile_id)
);

create index document_acceptances_profile_idx
  on public.document_acceptances (profile_id);

alter table public.document_acceptances enable row level security;

-- Chacun voit ses acceptations ; l'Admin RH et le Super-Admin voient tout.
create policy "document_acceptances_select"
  on public.document_acceptances for select to authenticated
  using (
    profile_id in (
      select id from public.profiles
      where clerk_user_id = public.current_clerk_id()
    )
    or public.current_user_role() in ('admin_rh', 'super_admin')
  );

-- On n'accepte que pour soi-même, jamais au nom d'un autre.
create policy "document_acceptances_insert"
  on public.document_acceptances for insert to authenticated
  with check (
    profile_id in (
      select id from public.profiles
      where clerk_user_id = public.current_clerk_id()
    )
  );

-- Une acceptation est une preuve : ni modification ni suppression.
revoke all on public.document_acceptances from anon;
revoke update, delete, truncate on public.document_acceptances from authenticated;
