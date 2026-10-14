-- Lot 6 — Bilans (étape 6.6) : suivi des e-mails envoyés aux directeurs.
--
-- À la publication d'un bilan, le serveur envoie un e-mail à chaque directeur
-- actif de l'école (avec un lien vers le portail, jamais le PDF en pièce
-- jointe). Cette table garde une ligne par bilan et par directeur : envoyé ou en
-- échec, pour que la Direction sache qui a été prévenu et puisse relancer les
-- échecs.
--
-- Elle ne contient AUCUNE adresse e-mail : seulement l'identifiant du profil. Les
-- adresses sont lues par le serveur au moment de l'envoi et n'apparaissent jamais
-- à l'écran de la Direction. Seul le serveur écrit (clé de service) : aucun
-- navigateur ne peut inscrire un envoi. Aucune suppression physique.

create table public.bilan_deliveries (
  id uuid primary key default gen_random_uuid(),
  bilan_id uuid not null references public.bilans (id),
  -- Le directeur destinataire.
  profile_id uuid not null references public.profiles (id),
  status text not null check (status in ('envoye', 'echec')),
  -- Nombre de tentatives (la relance d'un échec l'augmente).
  attempts integer not null default 1 check (attempts >= 1),
  sent_at timestamptz,
  -- Raison courte d'un échec, sans donnée personnelle.
  last_error text check (last_error is null or char_length(last_error) <= 300),
  provider_message_id text
    check (provider_message_id is null or char_length(provider_message_id) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un seul suivi par bilan et par directeur.
  unique (bilan_id, profile_id),
  -- « Envoyé » si et seulement si une date d'envoi existe.
  check ((status = 'envoye') = (sent_at is not null))
);

create index bilan_deliveries_bilan_idx on public.bilan_deliveries (bilan_id);

create trigger bilan_deliveries_set_updated_at
  before update on public.bilan_deliveries
  for each row execute function public.set_updated_at();

alter table public.bilan_deliveries enable row level security;

-- Lecture : la Direction pédagogique (pour voir qui a été prévenu).
create policy "bilan_deliveries_select"
  on public.bilan_deliveries for select to authenticated
  using (public.is_pedagogy_manager());

-- Aucune politique d'écriture : seul le serveur (clé de service) enregistre les
-- envois. On retire aussi les droits d'écriture, et tout accès aux anonymes.
revoke all on public.bilan_deliveries from anon;
revoke insert, update, delete, truncate on public.bilan_deliveries from authenticated;
