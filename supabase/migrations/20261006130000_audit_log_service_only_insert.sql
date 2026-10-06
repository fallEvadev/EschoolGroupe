-- Sécurité : le journal d'audit n'est écrit que par le serveur.
--
-- La politique `audit_log_insert` laissait tout utilisateur connecté insérer
-- des lignes au journal sous son propre nom, directement avec la clé publique
-- et son jeton. L'application n'en a pas besoin : elle écrit via la clé de
-- service (`src/lib/audit.ts`), qui ne passe pas par la RLS. On retire donc
-- la politique et le droit d'insertion.

drop policy "audit_log_insert" on public.audit_log;

revoke insert on public.audit_log from authenticated;
