import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { requireSpace } from "@/lib/auth/guards";
import { parseRole } from "@/lib/auth/roles";
import { formatDate } from "@/lib/dates";
import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { describeSupabaseError } from "@/lib/supabase/errors";

import { GrantAccessForm } from "./grant-access-form";
import {
  PendingInvitationRow,
  type PendingInvitation,
} from "./pending-invitation-row";
import { UserAccessRow, type AccessUser } from "./user-access-row";

/** Personnes invitées qui n'ont pas encore activé leur compte. */
async function loadPendingInvitations(): Promise<{
  invitations: PendingInvitation[];
  notice: string | null;
}> {
  if (!isSupabaseConfigured()) return { invitations: [], notice: null };
  // Client avec le jeton de l'utilisateur : la RLS s'applique.
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, invited_at")
    .eq("status", "invite")
    .order("invited_at", { ascending: false });
  if (error) {
    return {
      invitations: [],
      notice: describeSupabaseError("profiles", error).message,
    };
  }
  return {
    notice: null,
    invitations: data.map((profile) => ({
      profileId: profile.id,
      name: profile.full_name,
      email: profile.email,
      role: profile.role,
      invitedAt: profile.invited_at ? formatDate(profile.invited_at) : null,
    })),
  };
}

export const metadata = { title: "Accès & rôles · E-School Groupe" };

export default async function AccesPage() {
  // Second verrou : l'espace admin ne suffit pas, il faut être Super-Admin.
  const role = await requireSpace("admin");
  if (role !== "super_admin") redirect("/non-autorise");

  const { userId } = await auth();
  const client = await clerkClient();
  const [{ data, totalCount }, pending] = await Promise.all([
    client.users.getUserList({ limit: 100, orderBy: "-created_at" }),
    loadPendingInvitations(),
  ]);

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
        description="Donnez un accès aux nouvelles personnes, attribuez un rôle aux comptes existants et désactivez les accès. Un compte désactivé n'est jamais supprimé : son historique est conservé."
      />

      {pending.notice && (
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {pending.notice}
        </p>
      )}

      <GrantAccessForm />

      {pending.invitations.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">
            Invitations en attente ({pending.invitations.length})
          </h2>
          <Card>
            <ul className="divide-border divide-y">
              {pending.invitations.map((invitation) => (
                <PendingInvitationRow
                  key={invitation.profileId}
                  invitation={invitation}
                />
              ))}
            </ul>
          </Card>
        </section>
      )}

      <h2 className="text-lg font-semibold">Comptes actifs et désactivés</h2>
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
