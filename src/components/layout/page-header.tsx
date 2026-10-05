/**
 * En-tête de page (maquette « Direction pédagogique ») : petite ligne bleue
 * en capitales, grand titre et phrase d'explication, actions à droite.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        {eyebrow && (
          <p className="text-primary text-xs font-semibold tracking-[0.12em] uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-extrabold sm:text-4xl">{title}</h1>
        {description && (
          <p className="text-muted-foreground max-w-3xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </header>
  );
}
