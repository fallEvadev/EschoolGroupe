/** Échappe le texte inséré dans le HTML : un nom ou un titre ne doit jamais pouvoir injecter de code. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type BilanEmailInput = {
  /** Nom du directeur destinataire. */
  recipientName: string;
  schoolName: string;
  /** « Bilan hebdomadaire » ou « Bilan mensuel ». */
  title: string;
  /** « Semaine du 05/10/2026 au 11/10/2026 » ou « Octobre 2026 ». */
  periodLabel: string;
  /** Adresse de la page des bilans du portail (jamais le PDF lui-même). */
  portalUrl: string;
  organizationName: string;
};

export type BilanEmail = { subject: string; text: string; html: string };

/**
 * E-mail « un bilan est disponible ». Il ne contient qu'un lien vers le portail
 * (connexion obligatoire) : le PDF n'est jamais en pièce jointe, pour qu'un
 * message transféré ne donne pas accès au document.
 */
export function buildBilanEmail(input: BilanEmailInput): BilanEmail {
  const { recipientName, schoolName, title, periodLabel, portalUrl } = input;
  const subject = `${title} · ${schoolName} · ${periodLabel}`;

  const text = [
    `Bonjour ${recipientName},`,
    "",
    `Le ${title.toLowerCase()} de ${schoolName} est disponible (${periodLabel}).`,
    "",
    "Vous pouvez le consulter et le télécharger dans votre espace partenaire :",
    portalUrl,
    "",
    "Cordialement,",
    input.organizationName,
  ].join("\n");

  const html = `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#f3f5fa;font-family:Arial,Helvetica,sans-serif;color:#0b1437;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;">
      <tr>
        <td style="padding:28px;">
          <p style="margin:0 0 16px;font-size:16px;">Bonjour ${escapeHtml(recipientName)},</p>
          <p style="margin:0 0 8px;font-size:16px;">
            Le <strong>${escapeHtml(title.toLowerCase())}</strong> de
            <strong>${escapeHtml(schoolName)}</strong> est disponible.
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#5b6785;">${escapeHtml(periodLabel)}</p>
          <p style="margin:0 0 24px;">
            <a href="${escapeHtml(portalUrl)}" style="display:inline-block;background:#2952d9;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;font-size:15px;">
              Consulter le bilan
            </a>
          </p>
          <p style="margin:0 0 4px;font-size:13px;color:#5b6785;">
            Vous devez vous connecter à votre espace partenaire pour le télécharger.
          </p>
          <p style="margin:24px 0 0;font-size:14px;">Cordialement,<br />${escapeHtml(input.organizationName)}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

/**
 * Message d'erreur du fournisseur d'e-mail, rendu sûr avant d'être gardé : toute
 * adresse e-mail qu'il contiendrait est masquée (le suivi ne doit jamais
 * stocker d'adresse), et la longueur est limitée.
 */
export function sanitizeProviderError(
  message: string | null | undefined,
): string {
  const cleaned = (message ?? "Erreur inconnue")
    .replace(/[^\s@<>"']+@[^\s@<>"']+/g, "[adresse]")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || "Erreur inconnue").slice(0, 300);
}

export type DeliverySummary = {
  /** Resend est-il configuré (clé et adresse d'expédition) ? */
  configured: boolean;
  sent: number;
  failed: number;
};

/** Phrase de résultat affichée après une publication ou un renvoi. */
export function summarizeDeliveries(summary: DeliverySummary): string {
  if (!summary.configured) {
    return "L'e-mail n'est pas configuré : les directeurs sont prévenus dans l'application seulement.";
  }
  if (summary.sent === 0 && summary.failed === 0) {
    return "Aucun directeur actif à prévenir par e-mail pour cette école.";
  }
  const parts: string[] = [];
  if (summary.sent > 0) {
    parts.push(`${summary.sent} envoyé${summary.sent > 1 ? "s" : ""}`);
  }
  if (summary.failed > 0) {
    parts.push(`${summary.failed} en échec`);
  }
  return `E-mails : ${parts.join(", ")}.`;
}
