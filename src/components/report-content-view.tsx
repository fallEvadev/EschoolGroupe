import type { ReportContent } from "@/lib/reports";

/** Contenu d'un rapport en lecture seule : classes, thème, matériel et pannes. */
export function ReportContentView({ content }: { content: ReportContent }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-muted-foreground text-sm">Classe(s)</p>
        <p>{content.classes}</p>
      </div>
      <div>
        <p className="text-muted-foreground text-sm">Thème du cours</p>
        <p className="whitespace-pre-wrap">{content.courseTheme}</p>
      </div>
      <div>
        <p className="text-muted-foreground text-sm">Matériel</p>
        {content.equipmentOk ? (
          <p>Tout fonctionne.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {content.issues.map((issue, index) => (
              <li key={index}>
                <span className="font-medium">{issue.equipment}</span> :{" "}
                {issue.description}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
