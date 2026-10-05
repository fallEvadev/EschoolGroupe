-- Lot 1 — Socle : paramètres de l'organisation (page « Paramètres » du Super-Admin).
-- Une seule ligne : nom affiché, année scolaire et semestre en cours.

create table public.organization_settings (
  -- Toujours `true` : garantit qu'il n'existe qu'une seule ligne.
  id boolean primary key default true check (id),
  organization_name text not null
    check (char_length(organization_name) between 2 and 120),
  -- Format « 2025-2026 », la seconde année suit la première.
  academic_year text not null
    check (
      academic_year ~ '^\d{4}-\d{4}$'
      and split_part(academic_year, '-', 2)::int
        = split_part(academic_year, '-', 1)::int + 1
    ),
  current_semester smallint not null default 1
    check (current_semester in (1, 2)),
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organization_settings_set_updated_at
  before update on public.organization_settings
  for each row execute function public.set_updated_at();

insert into public.organization_settings (organization_name, academic_year)
values ('E-School Groupe', '2025-2026');

alter table public.organization_settings enable row level security;

-- Lecture pour tout utilisateur connecté (affichage dans les en-têtes).
create policy "organization_settings_select"
  on public.organization_settings for select to authenticated
  using (true);

-- Modification : Super-Admin uniquement.
create policy "organization_settings_update"
  on public.organization_settings for update to authenticated
  using (public.current_user_role() = 'super_admin')
  with check (public.current_user_role() = 'super_admin');

-- Ligne unique : ni ajout ni suppression, et rien pour les visiteurs anonymes.
revoke all on public.organization_settings from anon;
revoke insert, delete, truncate on public.organization_settings from authenticated;
