import { MobileShell } from "@/components/layout/bottom-nav";
import { requireSpace } from "@/lib/auth/guards";

export default async function FormateurLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSpace("formateur");
  return <MobileShell space="formateur">{children}</MobileShell>;
}
