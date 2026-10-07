-- Lot 3 — Pointage (étape 3) : pointages des formateurs et tentatives de code.
--
-- Écriture réservée au SERVEUR : les formateurs ne lisent jamais un code du jour
-- et ne peuvent pas s'écrire un pointage eux-mêmes. L'application vérifie le
-- code, la fenêtre horaire et la position, puis écrit avec la clé de service
-- (qui ne passe pas par la RLS). Ici, la base garantit qu'aucun utilisateur
-- connecté ne peut écrire directement, et qu'il n'existe qu'un pointage par
-- formateur, créneau et jour.

-- ---------------------------------------------------------------------------
-- attendances : un pointage enregistré
-- ---------------------------------------------------------------------------
create table public.attendances (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id),
  slot_id uuid not null references public.time_slots (id),
  -- Recopié du créneau pour les listes et statistiques par école.
  school_id uuid not null references public.schools (id),
  -- Jour du pointage, en heure de Dakar.
  attendance_date date not null,
  recorded_at timestamptz not null default now(),
  -- present = à l'heure ; retard = après l'heure de début + tolérance ;
  -- a_verifier = position non confirmée (hors rayon, refusée, imprécise…).
  status text not null check (status in ('present', 'retard', 'a_verifier')),
  -- Minutes écoulées depuis l'heure de début, seulement si le statut est retard.
  late_minutes integer not null default 0 check (late_minutes >= 0),
  -- Résultat du contrôle de position.
  location_result text not null check (
    location_result in (
      'ok',
      'hors_rayon',
      'imprecise',
      'refusee',
      'indisponible',
      'ecole_sans_position'
    )
  ),
  -- Distance à l'école et précision du GPS, en mètres. Les coordonnées exactes
  -- du formateur ne sont volontairement PAS conservées.
  distance_m integer check (distance_m is null or distance_m >= 0),
  accuracy_m integer check (accuracy_m is null or accuracy_m >= 0),
  -- Un seul pointage par formateur, créneau et jour.
  unique (profile_id, slot_id, attendance_date),
  -- « À vérifier » si et seulement si la position n'est pas confirmée.
  check ((location_result = 'ok') = (status <> 'a_verifier'))
);

create index attendances_school_day_idx
  on public.attendances (school_id, attendance_date);
create index attendances_profile_day_idx
  on public.attendances (profile_id, attendance_date);

alter table public.attendances enable row level security;

-- Lecture : chaque formateur voit ses pointages, la Direction pédagogique voit
-- tout. Aucune politique d'écriture : seul le serveur (clé de service) écrit.
create policy "attendances_select"
  on public.attendances for select to authenticated
  using (
    profile_id = public.current_profile_id()
    or public.is_pedagogy_manager()
  );

revoke all on public.attendances from anon;
revoke insert, update, delete, truncate on public.attendances from authenticated;

-- ---------------------------------------------------------------------------
-- attendance_attempts : tentatives de code (pour limiter les essais)
-- ---------------------------------------------------------------------------
create table public.attendance_attempts (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id),
  school_id uuid not null references public.schools (id),
  succeeded boolean not null,
  attempted_at timestamptz not null default now()
);

-- Retrouver vite les échecs récents d'un formateur.
create index attendance_attempts_recent_failures_idx
  on public.attendance_attempts (profile_id, attempted_at desc)
  where not succeeded;

-- RLS activée sans aucune politique : personne ne lit ni n'écrit avec un
-- jeton utilisateur. Seul le serveur (clé de service) y accède.
alter table public.attendance_attempts enable row level security;

revoke all on public.attendance_attempts from anon, authenticated;
