import { auth } from "@clerk/nextjs/server";
import { Plus } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

import { requireStaffManager } from "./access";

import { FILTERS, type FilterKey, loadProfiles } from "./directory";

import { PersonnelContent } from "./directory-content";
export const metadata = { title: "Personnel · E-School" };

export default async function PersonnelPage({
  searchParams,
}: PageProps<"/admin/personnel">) {
  const role = await requireStaffManager();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const filtre: FilterKey =
    FILTERS.find((f) => f.key === params.filtre)?.key ?? "tous";
  const ficheId = typeof params.fiche === "string" ? params.fiche : undefined;
  const docsFilter = params.docs === "a-verifier";
  const { userId } = await auth();

  const loaded = await loadProfiles();

  return (
    <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Organisation · RH"
        title="Personnel"
        description="Fiches du personnel, invitations et suivi RH."
        actions={
          <Button asChild>
            <Link href="/admin/personnel/nouveau">
              <Plus aria-hidden />
              Ajouter une personne
            </Link>
          </Button>
        }
      />

      {"error" in loaded ? (
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {loaded.error}
        </p>
      ) : (
        <PersonnelContent
          profiles={loaded.profiles}
          pendingProfileIds={loaded.pendingProfileIds}
          role={role}
          q={q}
          filtre={filtre}
          docsFilter={docsFilter}
          ficheId={ficheId}
          currentUserId={userId}
        />
      )}
    </main>
  );
}
