-- Lot 2 — RH (étape 5) : contrôle des documents du dossier du personnel.
-- Chaque pièce est « à vérifier » à l'envoi, puis validée ou rejetée (avec
-- motif) par l'Admin RH ou le Super-Admin. Les politiques RLS de
-- `staff_documents` couvrent déjà ces colonnes : aucune nouvelle politique.

alter table public.staff_documents
  add column review_status text not null default 'a_verifier'
    check (review_status in ('a_verifier', 'valide', 'rejete')),
  add column review_reason text
    check (review_reason is null or char_length(review_reason) <= 500),
  add column reviewed_by text,
  add column reviewed_at timestamptz,
  -- Un rejet sans motif n'a aucun sens pour la personne qui doit corriger.
  add constraint staff_documents_rejection_needs_reason
    check (review_status <> 'rejete' or review_reason is not null);

-- Retrouver vite les pièces en attente de contrôle (vue « À vérifier »).
create index staff_documents_pending_review_idx
  on public.staff_documents (profile_id)
  where status = 'actif' and review_status = 'a_verifier';
