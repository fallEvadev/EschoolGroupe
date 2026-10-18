import { auth } from "@clerk/nextjs/server";

import { ProfilePage } from "@/components/profile/profile-page";
import { requireSpace } from "@/lib/auth/guards";
import { loadMyProfile } from "@/lib/profile-data";

export const metadata = { title: "Profil · E-School Groupe" };

export default async function MaintenanceProfilPage() {
  await requireSpace("maintenance");
  const { userId } = await auth();
  const profile = userId ? await loadMyProfile(userId) : null;

  if (profile && "error" in profile) {
    return (
      <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {profile.error}
        </p>
      </main>
    );
  }
  if (!profile) {
    return (
      <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
        <p className="text-muted-foreground">
          Aucune fiche n&apos;est liée à ce compte. Contactez les ressources
          humaines.
        </p>
      </main>
    );
  }

  return (
    <ProfilePage
      profile={profile}
      eyebrow="Maintenance"
      canEditPhone={profile.role === "maintenancier"}
    />
  );
}
