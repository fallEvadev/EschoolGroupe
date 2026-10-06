import {
  ListCardSkeleton,
  PageHeaderSkeleton,
} from "@/components/layout/page-skeleton";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Chargement de la page Personnel : chiffres, annuaire et fiche. */
export default function PersonnelLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Chargement du personnel"
      className="flex w-full flex-col gap-6 p-4 sm:p-8"
    >
      <PageHeaderSkeleton />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} className="flex flex-col gap-3 p-4 lg:p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-12" />
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <ListCardSkeleton rows={6} />
        <Card className="hidden flex-col gap-4 p-6 lg:flex">
          <div className="flex items-center gap-4">
            <Skeleton className="size-16 rounded-full" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </Card>
      </div>
    </main>
  );
}
