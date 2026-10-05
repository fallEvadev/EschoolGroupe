import { UserButton } from "@clerk/nextjs";

import { Brand } from "@/components/layout/brand";
import { requireSpace } from "@/lib/auth/guards";

/** Portail partenaire : lecture seule, en-tête simple (pas de maquette fournie). */
export default async function PartenaireLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSpace("partenaire");
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col">
      <header className="flex h-16 items-center justify-between px-4">
        <Brand className="text-navy" />
        <UserButton />
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
