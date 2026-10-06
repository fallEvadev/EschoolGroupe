/** Forme minimale d'un utilisateur Clerk reçu par le webhook (seuls les champs utiles). */
type ClerkWebhookUser = {
  primary_email_address_id: string | null;
  email_addresses: {
    id: string;
    email_address: string;
    verification?: { status?: string } | null;
  }[];
};

/**
 * Adresse principale d'un compte Clerk, en minuscules, et si Clerk l'a
 * vérifiée. Une adresse non vérifiée ne prouve rien : n'importe qui peut la
 * saisir à l'inscription. Seule une adresse vérifiée peut servir à relier un
 * compte à une fiche du personnel.
 */
export function primaryEmail(user: ClerkWebhookUser): {
  address: string;
  verified: boolean;
} {
  const primary = user.email_addresses.find(
    (email) => email.id === user.primary_email_address_id,
  );
  return {
    address: (primary?.email_address ?? "").toLowerCase(),
    verified: primary?.verification?.status === "verified",
  };
}
