import { MobileShell } from "@/components/layout/bottom-nav";
import { requireSpace } from "@/lib/auth/guards";
import { requireRulesAccepted } from "@/lib/internal-rules";

export default async function FormateurLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await requireSpace("formateur");
  // Tant que le règlement en vigueur n'est pas accepté : page d'acceptation.
  await requireRulesAccepted(role);
  return <MobileShell space="formateur">{children}</MobileShell>;
}
