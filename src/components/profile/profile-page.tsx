import { PageHeader } from "@/components/layout/page-header";
import { AccountActions } from "@/components/profile/account-actions";
import { PhoneForm } from "@/components/profile/phone-form";
import { ThemeChoiceButtons } from "@/components/profile/theme-choice";
import { InstallCard } from "@/components/pwa/install-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { parseRole, ROLE_LABELS } from "@/lib/auth/roles";
import { formatDate, formatDateTime } from "@/lib/dates";
import type { MyProfile } from "@/lib/profile-data";
import { CONTRACT_LABELS, formatPhone, isContractType } from "@/lib/staff";

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-3 p-4 sm:p-6">
      <h2 className="text-primary text-xs font-semibold tracking-[0.12em] uppercase">
        {title}
      </h2>
      {children}
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="font-medium break-words">{value ?? "Non renseigné"}</dd>
    </div>
  );
}

/**
 * Page « Profil » du formateur et du maintenancier : leurs informations (en
 * lecture seule, la fiche appartient aux RH), le règlement, le compte,
 * l'affichage et l'installation. Les documents du dossier n'y figurent pas.
 */
export function ProfilePage({
  profile,
  eyebrow,
  canEditPhone,
}: {
  profile: MyProfile;
  eyebrow: string;
  canEditPhone: boolean;
}) {
  const role = parseRole(profile.role);
  const contract =
    profile.contractType && isContractType(profile.contractType)
      ? CONTRACT_LABELS[profile.contractType]
      : null;

  return (
    <main className="flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow={eyebrow}
        title="Mon profil"
        description="Vos informations et vos réglages."
      />

      <Block title="Mes informations">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xl font-bold">{profile.fullName}</p>
          <Badge variant={profile.status === "actif" ? "success" : "neutral"}>
            {profile.status === "actif" ? "Compte actif" : "Compte inactif"}
          </Badge>
        </div>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Info label="Rôle" value={role ? ROLE_LABELS[role] : null} />
          <Info label="Adresse e-mail" value={profile.email} />
          <Info label="Poste" value={profile.jobTitle} />
          <Info label="Type de contrat" value={contract} />
          <Info
            label="Date d'embauche"
            value={profile.hireDate ? formatDate(profile.hireDate) : null}
          />
          {!canEditPhone && (
            <Info
              label="Téléphone"
              value={profile.phone ? formatPhone(profile.phone) : null}
            />
          )}
        </dl>
        <p className="text-muted-foreground text-sm">
          Pour corriger une information, contactez les ressources humaines.
        </p>
      </Block>

      {canEditPhone && (
        <Block title="Mon numéro">
          <PhoneForm initialPhone={profile.phone} />
        </Block>
      )}

      {profile.rules && (
        <Block title="Règlement intérieur">
          <p className="text-sm">
            {profile.rules.acceptedAt
              ? `Version ${profile.rules.version} acceptée le ${formatDateTime(profile.rules.acceptedAt)}.`
              : `La version ${profile.rules.version} n'est pas encore acceptée.`}
          </p>
        </Block>
      )}

      <Block title="Mon compte">
        <AccountActions />
      </Block>

      <Block title="Affichage">
        <ThemeChoiceButtons />
      </Block>

      <InstallCard />
    </main>
  );
}
