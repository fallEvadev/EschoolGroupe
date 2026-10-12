import { useId } from "react";

import { Card } from "@/components/ui/card";
import { axisTicks, niceMax } from "@/lib/dashboard";

export type ChartSeries = {
  label: string;
  /** Variable de thème de la couleur de la série. */
  color: "chart-1" | "chart-2" | "chart-3";
};

export type ChartCategory = {
  /** Texte complet (info-bulle et tableau), ex. « Semaine du 05/10 ». */
  label: string;
  /** Texte court sous la colonne, ex. « 05/10 ». */
  axisLabel: string;
};

// Géométrie du dessin (le SVG s'adapte à la largeur de l'écran).
const WIDTH = 360;
const HEIGHT = 200;
const MARGIN = { top: 10, right: 8, bottom: 28, left: 32 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;
/** Colonne fine : 24 px au plus, jamais toute la largeur disponible. */
const MAX_BAR = 24;
/** Espace de la couleur de fond entre deux segments empilés. */
const GAP = 2;
/** Arrondi du bout de la colonne ; le pied reste droit, collé à la ligne de base. */
const RADIUS = 4;
/** Hauteur minimale d'un segment non nul, pour qu'il reste visible. */
const MIN_SEGMENT = 2;

const fillOf = (color: ChartSeries["color"]) => ({ fill: `var(--${color})` });

/** Rectangle dont seul le haut est arrondi. */
function roundedTop(x: number, y: number, w: number, h: number): string {
  const r = Math.min(RADIUS, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function plural(count: number, label: string): string {
  return `${count} ${label}`;
}

/**
 * Graphique en colonnes (empilées s'il y a plusieurs séries), dessiné en SVG
 * sans bibliothèque. Une légende est affichée pour deux séries ou plus, chaque
 * colonne porte une info-bulle, et le tableau de données (« Voir les données »)
 * donne les mêmes chiffres : la couleur ne porte jamais l'information seule.
 */
export function ColumnChart({
  title,
  description,
  categories,
  series,
  values,
  unit,
  emptyText,
}: {
  title: string;
  description?: string;
  categories: readonly ChartCategory[];
  series: readonly ChartSeries[];
  /** `values[i][j]` : nombre de la série `j` pour la colonne `i`. */
  values: readonly (readonly number[])[];
  /** Ce qu'on compte, au pluriel (« pointages ») : sert aux info-bulles et au résumé. */
  unit: string;
  emptyText: string;
}) {
  const titleId = useId();
  const totals = values.map((line) => line.reduce((sum, n) => sum + n, 0));
  const grandTotal = totals.reduce((sum, n) => sum + n, 0);
  const max = niceMax(Math.max(0, ...totals));
  const ticks = axisTicks(max);
  const slot = PLOT_WIDTH / Math.max(1, categories.length);
  const barWidth = Math.min(MAX_BAR, slot * 0.62);
  const labelEvery =
    categories.length > 7 ? Math.ceil(categories.length / 7) : 1;
  const yOf = (value: number) =>
    MARGIN.top + PLOT_HEIGHT - (value / max) * PLOT_HEIGHT;
  const seriesTotals = series.map((_, j) =>
    values.reduce((sum, line) => sum + (line[j] ?? 0), 0),
  );

  return (
    <Card className="flex flex-col gap-3 p-4 sm:p-5">
      <div>
        <h3 id={titleId} className="font-semibold">
          {title}
        </h3>
        {description && (
          <p className="text-muted-foreground text-sm">{description}</p>
        )}
      </div>

      {series.length >= 2 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {series.map((s, j) => (
            <li key={s.label} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2.5 rounded-sm"
                style={{ backgroundColor: `var(--${s.color})` }}
              />
              <span>{s.label}</span>
              <span className="text-muted-foreground tabular-nums">
                {seriesTotals[j]}
              </span>
            </li>
          ))}
        </ul>
      )}

      {grandTotal === 0 ? (
        <p className="text-muted-foreground bg-muted/40 rounded-lg p-4 text-center text-sm">
          {emptyText}
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-labelledby={titleId}
          className="w-full max-w-xl"
        >
          {/* Graduations : lignes fines et discrètes */}
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={WIDTH - MARGIN.right}
                y1={yOf(tick)}
                y2={yOf(tick)}
                className="stroke-border"
                strokeWidth={1}
              />
              <text
                x={MARGIN.left - 5}
                y={yOf(tick) + 3}
                textAnchor="end"
                fontSize={11}
                className="fill-muted-foreground"
              >
                {tick}
              </text>
            </g>
          ))}

          {categories.map((category, i) => {
            const line = values[i] ?? [];
            const x = MARGIN.left + slot * i + (slot - barWidth) / 2;
            // Segments non nuls, du bas vers le haut.
            const segments = series
              .map((s, j) => ({ s, value: line[j] ?? 0 }))
              .filter((segment) => segment.value > 0);
            let base = yOf(0);
            const tip = segments.length - 1;
            const detail = series
              .map((s, j) => `${plural(line[j] ?? 0, s.label.toLowerCase())}`)
              .join(", ");

            return (
              <g key={category.label}>
                <title>{`${category.label} : ${totals[i] ?? 0} ${unit} (${detail})`}</title>
                {segments.map((segment, k) => {
                  const full = Math.max(
                    MIN_SEGMENT,
                    (segment.value / max) * PLOT_HEIGHT,
                  );
                  const top = base - full;
                  // Le segment du haut est arrondi ; les autres laissent un espace avant le suivant.
                  const shape =
                    k === tip ? (
                      <path
                        d={roundedTop(x, top, barWidth, full)}
                        style={fillOf(segment.s.color)}
                      />
                    ) : (
                      <rect
                        x={x}
                        y={top + GAP}
                        width={barWidth}
                        height={Math.max(1, full - GAP)}
                        style={fillOf(segment.s.color)}
                      />
                    );
                  base = top;
                  return <g key={segment.s.label}>{shape}</g>;
                })}
                {/* Zone de survol plus large que la colonne */}
                <rect
                  x={MARGIN.left + slot * i}
                  y={MARGIN.top}
                  width={slot}
                  height={PLOT_HEIGHT}
                  fill="transparent"
                />
                {(categories.length - 1 - i) % labelEvery === 0 && (
                  <text
                    x={MARGIN.left + slot * i + slot / 2}
                    y={HEIGHT - 9}
                    textAnchor="middle"
                    fontSize={11}
                    className="fill-muted-foreground"
                  >
                    {category.axisLabel}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}

      <details className="text-sm">
        <summary className="text-primary cursor-pointer font-medium">
          Voir les données
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="text-muted-foreground">
                <th scope="col" className="py-1 pr-4 font-medium">
                  Période
                </th>
                {series.map((s) => (
                  <th
                    key={s.label}
                    scope="col"
                    className="py-1 pr-4 text-right font-medium"
                  >
                    {s.label}
                  </th>
                ))}
                {series.length >= 2 && (
                  <th scope="col" className="py-1 text-right font-medium">
                    Total
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {categories.map((category, i) => (
                <tr key={category.label} className="border-t">
                  <th scope="row" className="py-1 pr-4 font-normal">
                    {category.label}
                  </th>
                  {series.map((s, j) => (
                    <td
                      key={s.label}
                      className="py-1 pr-4 text-right tabular-nums"
                    >
                      {values[i]?.[j] ?? 0}
                    </td>
                  ))}
                  {series.length >= 2 && (
                    <td className="py-1 text-right font-medium tabular-nums">
                      {totals[i] ?? 0}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  );
}
