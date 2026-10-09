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
  // Tant que le règlement en vigueur n'est pas accepté : page d'acceptation.
  await requireRulesAccepted(role);
  const unreadCount = await countUnread();
  return (
    <MobileShell space="formateur" unreadCount={unreadCount}>
      {children}
    </MobileShell>
  );
}
