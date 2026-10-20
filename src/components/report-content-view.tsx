import { courseHours, headcountLabel, type ReportContent } from "@/lib/reports";

/**
 * Contenu d'un rapport en lecture seule : les cours de la journée (heures,
 * classe, thème, effectif), puis les difficultés rencontrées.
 */
export function ReportContentView({ content }: { content: ReportContent }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm">
          {content.courses.length > 1 ? "Cours de la journée" : "Cours"}
        </p>
        <ul className="flex flex-col gap-2">
          {content.courses.map((course, index) => {
            const hours = courseHours(course);
            const headcount = headcountLabel(course.headcount);
            return (
              <li
                key={index}
                className="border-input flex flex-col gap-0.5 rounded-lg border p-3"
              >
                <p className="font-medium">
                  {hours && (
                    <span className="font-heading tabular-nums">{hours} · </span>
                  )}
                  {course.classes || "Classe non indiquée"}
                  {headcount && (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · {headcount}
                    </span>
                  )}
                </p>
                <p className="whitespace-pre-wrap">{course.theme}</p>
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <p className="text-muted-foreground text-sm">Difficultés rencontrées</p>
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
