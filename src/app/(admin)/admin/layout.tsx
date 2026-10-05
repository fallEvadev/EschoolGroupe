import { AdminShell } from "@/components/layout/admin-shell";
import { requireSpace } from "@/lib/auth/guards";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await requireSpace("admin");
  return <AdminShell role={role}>{children}</AdminShell>;
}
