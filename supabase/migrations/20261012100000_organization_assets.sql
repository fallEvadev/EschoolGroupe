-- Lot 6 — Bilans (étape 6.1) : logo et signature de l'organisation.
--
-- Le Super-Admin téléverse le logo E-School et la signature depuis la page
-- Paramètres. Ces deux images servent aux documents générés (bilans). Elles
-- sont dans un bucket PRIVÉ : personne ne les lit par une adresse publique.
-- Aucune suppression physique : remplacer une image envoie un nouveau fichier et
-- change le chemin mémorisé ; l'ancien fichier reste dans le stockage.

-- ---------------------------------------------------------------------------
-- Bucket privé : 1 Mo maximum, PNG ou JPEG uniquement
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-assets',
  'organization-assets',
  false,
  1048576,
  array['image/png', 'image/jpeg']
);

-- ---------------------------------------------------------------------------
-- Chemins mémorisés dans les paramètres de l'organisation
-- ---------------------------------------------------------------------------
-- Forme imposée : « logo/<uuid>.png » ou « signature/<uuid>.jpg ». Vide tant
-- qu'aucune image n'a été envoyée. La politique de mise à jour existante de
-- `organization_settings` (Super-Admin seulement) s'applique à ces colonnes.
alter table public.organization_settings
  add column logo_path text
    check (
      logo_path is null
      or logo_path ~ '^logo/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg)$'
    ),
  add column signature_path text
    check (
      signature_path is null
      or signature_path ~ '^signature/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg)$'
    );

-- ---------------------------------------------------------------------------
-- Stockage
-- ---------------------------------------------------------------------------
-- Lecture : la Direction pédagogique et le Super-Admin (ils génèrent les bilans
-- qui contiennent le logo et la signature).
create policy "organization_assets_storage_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'organization-assets'
    and public.is_pedagogy_manager()
  );

-- Envoi : le Super-Admin seulement.
create policy "organization_assets_storage_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'organization-assets'
    and public.current_user_role() = 'super_admin'
  );

-- Aucune politique update / delete : un fichier envoyé n'est jamais écrasé
-- ni supprimé.
