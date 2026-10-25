import { toast } from "sonner";

/**
 * Confirmation ou erreur d'une action, sous forme de toast : vert quand
 * l'action est terminée, rouge sinon. Le texte vient du serveur (en français).
 */
export function notify(result: { ok: boolean; message: string }): void {
  if (!result.message) return;
  if (result.ok) toast.success(result.message);
  else toast.error(result.message);
}
