/** Indicatif du Sénégal, ajouté aux numéros locaux à 9 chiffres. */
const SENEGAL_PREFIX = "221";

/**
 * Numéro au format attendu par WhatsApp (chiffres seuls, avec indicatif) :
 * « 77 123 45 67 » → « 221771234567 ». `null` si le numéro est inutilisable.
 */
export function toWhatsAppNumber(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "").replace(/^00/, "");
  if (/^[37]\d{8}$/.test(digits)) return SENEGAL_PREFIX + digits;
  if (/^\d{10,15}$/.test(digits)) return digits;
  return null;
}

/**
 * Lien qui ouvre WhatsApp (application ou WhatsApp Web) avec le message déjà
 * écrit. Sans numéro, WhatsApp demande de choisir le contact.
 */
export function buildWhatsAppUrl(phone: string | null, text: string): string {
  const number = toWhatsAppNumber(phone);
  const query = `text=${encodeURIComponent(text)}`;
  return number
    ? `https://wa.me/${number}?${query}`
    : `https://wa.me/?${query}`;
}

/** Message de la Direction pédagogique au directeur d'une école, avec le code du jour. */
export function directorCodeMessage({
  firstName,
  schoolName,
  dateLabel,
  code,
}: {
  firstName: string;
  schoolName: string;
  /** Jour en toutes lettres, ex. « mercredi 7 octobre ». */
  dateLabel: string;
  /** Code déjà mis en forme pour la lecture, ex. « 428 105 ». */
  code: string;
}): string {
  return [
    `Bonjour ${firstName},`,
    `Code de pointage du ${dateLabel} pour ${schoolName} : ${code}`,
    "À donner uniquement aux formateurs présents aujourd'hui. Merci de ne pas le diffuser.",
  ].join("\n");
}

/** Message du directeur aux formateurs de son école, avec le code du jour. */
export function trainersCodeMessage({
  schoolName,
  dateLabel,
  code,
}: {
  schoolName: string;
  dateLabel: string;
  code: string;
}): string {
  return [
    `Code de pointage du ${dateLabel} pour ${schoolName} : ${code}`,
    "Valable aujourd'hui seulement.",
  ].join("\n");
}

/** Message d'invitation envoyé par WhatsApp. */
export function invitationMessage({
  firstName,
  organizationName,
  roleLabel,
  url,
  validDays,
}: {
  firstName: string;
  organizationName: string;
  roleLabel: string;
  url: string;
  validDays: number;
}): string {
  return [
    `Bonjour ${firstName},`,
    `Votre accès à la plateforme ${organizationName} est prêt (${roleLabel}).`,
    `Activez votre compte et choisissez votre mot de passe ici (lien valable ${validDays} jours) :`,
    url,
  ].join("\n");
}
