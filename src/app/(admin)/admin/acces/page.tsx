import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { requireSpace } from "@/lib/auth/guards";
import { parseRole } from "@/lib/auth/roles";

import { UserAccessRow, type AccessUser } from "./user-access-row";

export const metadata = { title: "Accès & rôles · E-School Groupe" };

export default async function AccesPage() {
  // Second verrou : l'espace admin ne suffit pas, il faut être Super-Admin.
  const role = await requireSpace("admin");
  if (role !== "super_admin") redirect("/non-autorise");

  const { userId } = await auth();
  const client = await clerkClient();
  const { data, totalCount } = await client.users.getUserList({
    limit: 100,
    orderBy: "-created_at",
  });

  const users: AccessUser[] = data.map((user) => {
    const email = user.primaryEmailAddress?.emailAddress ?? "";
    return {
      id: user.id,
      name: [user.firstName, user.lastName].filter(Boolean).join(" ") || email,
      email,
      role: parseRole(user.publicMetadata?.role),
      banned: user.banned,
      isSelf: user.id === userId,
    };
  });

  return (
    <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Organisation · Super-Admin"
        title="Accès & rôles"
        description="Attribuez un rôle aux comptes existants et désactivez les accès. Un compte désactivé n'est jamais supprimé : son historique est conservé."
      />

      <Card>
        {users.length === 0 ? (
          <p className="text-muted-foreground p-4">
            Aucun compte pour le moment.
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {users.map((user) => (
              <UserAccessRow key={user.id} user={user} />
            ))}
          </ul>
        )}
      </Card>

      {totalCount > users.length && (
        <p className="text-muted-foreground text-sm">
          {users.length} comptes affichés sur {totalCount}. La pagination
          viendra avec le lot 2.
        </p>
      )}
    </main>
  );
}
