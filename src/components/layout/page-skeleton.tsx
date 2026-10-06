import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Forme de l'en-tête de page pendant le chargement. */
export function PageHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="h-9 w-64 max-w-full" />
      <Skeleton className="h-4 w-96 max-w-full" />
    </div>
  );
}

/** Forme d'une liste dans une carte (lignes avec pastille). */
export function ListCardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card className="divide-border divide-y">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 p-4">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-48 max-w-full" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
          <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
        </div>
      ))}
    </Card>
  );
}

/** Page générique en cours de chargement (espace admin). */
export function PageSkeleton() {
  return (
    <main
      aria-busy="true"
      aria-label="Chargement"
      className="flex w-full flex-col gap-6 p-4 sm:p-8"
    >
      <PageHeaderSkeleton />
      <ListCardSkeleton />
    </main>
  );
}
