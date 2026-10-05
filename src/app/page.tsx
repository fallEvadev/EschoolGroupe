import { redirect } from "next/navigation";

import { getCurrentRole } from "@/lib/auth/guards";
import { homeForRole } from "@/lib/auth/roles";

/** Aiguille chaque utilisateur vers son espace selon son rôle. */
export default async function Home() {
  const role = await getCurrentRole();
  redirect(role ? homeForRole(role) : "/non-autorise");
}
