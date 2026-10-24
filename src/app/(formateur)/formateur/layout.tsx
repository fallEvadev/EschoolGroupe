import { MobileShell } from "@/components/layout/bottom-nav";
import { requireSpace } from "@/lib/auth/guards";
import { requireRulesAccepted } from "@/lib/internal-rules";
import { countUnread } from "@/lib/notifications-data";

export default async function FormateurLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await requireSpace("formateur");
  // Les deux lectures partent ensemble (la base est distante, chaque aller-retour
  // compte). Tant que le règlement en vigueur n'est pas accepté : page d'acceptation.
  const [, unreadCount] = await Promise.all([
    requireRulesAccepted(role),
    countUnread(),
  ]);
  return (
    <MobileShell space="formateur" unreadCount={unreadCount}>
      {children}
    </MobileShell>
  );
}
