import { Card } from "@/components/ui/card";

/** Une tuile de chiffre : le nombre, puis son libellé et un détail facultatif (couleurs de texte du thème). */
export function StatTile({
  value,
  label,
  hint,
}: {
  value: string;
  label: string;
  hint?: string;
}) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm font-medium">{label}</p>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </Card>
  );
}
