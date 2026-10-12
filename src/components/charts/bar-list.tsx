import { Card } from "@/components/ui/card";

export type BarRow = { label: string; value: number };

/**
 * Barres horizontales (une série) : le nom à gauche, la barre, puis la valeur au
 * bout. Faites en HTML : le texte reste lisible et accessible tel quel, sans
 * tableau de plus. La barre est fine, arrondie au bout et collée à la ligne de
 * base ; sa longueur est proportionnelle à la plus grande valeur.
 */
export function BarList({
  title,
  description,
  rows,
  emptyText,
}: {
  title: string;
  description?: string;
  rows: readonly BarRow[];
  emptyText: string;
}) {
  const max = Math.max(0, ...rows.map((row) => row.value));

  return (
    <Card className="flex flex-col gap-3 p-4 sm:p-5">
      <div>
        <h3 className="font-semibold">{title}</h3>
        {description && (
          <p className="text-muted-foreground text-sm">{description}</p>
        )}
      </div>

      {max === 0 ? (
        <p className="text-muted-foreground bg-muted/40 rounded-lg p-4 text-center text-sm">
          {emptyText}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((row) => (
            <li
              key={row.label}
              className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm"
            >
              <span className="truncate" title={row.label}>
                {row.label}
              </span>
              <span className="bg-muted/60 h-3 rounded-r-[4px]">
                <span
                  className="bg-chart-1 block h-3 rounded-r-[4px]"
                  style={{ width: `${(row.value / max) * 100}%` }}
                />
              </span>
              <span className="min-w-6 text-right font-medium tabular-nums">
                {row.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
