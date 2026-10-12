import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { BarList } from "@/components/charts/bar-list";
import { ColumnChart } from "@/components/charts/column-chart";
import { StatTile } from "@/components/dashboard/stat-tile";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireSpace } from "@/lib/auth/guards";
import type { Role } from "@/lib/auth/roles";
import { ATTENDANCE_SERIES, REPORT_SERIES, shortDate } from "@/lib/dashboard";
import {
  loadHrDashboard,
  loadMaintenanceDashboard,
  loadPedagogyDashboard,
  type HrDashboard,
  type MaintenanceDashboard,
  type PedagogyDashboard,
} from "@/lib/dashboard-data";
import { dakarIsoDate, formatDate } from "@/lib/dates";
import { formatDuration, RECENT_DAYS } from "@/lib/ticket-stats";

export const metadata = { title: "Tableau de bord · E-School Groupe" };

/** Qui voit quelle section : les mêmes droits que les pages détaillées. */
const SECTION_ROLES = {
  pedagogy: ["admin_pedagogie", "super_admin"],
  hr: ["admin_rh", "super_admin"],
  maintenance: ["admin_maintenance", "super_admin"],
} as const satisfies Record<string, readonly Role[]>;

const allows = (section: keyof typeof SECTION_ROLES, role: Role) =>
  (SECTION_ROLES[section] as readonly Role[]).includes(role);

const dayLabel = (iso: string) => formatDate(`${iso}T12:00:00Z`);

export default async function AdminPage() {
  const role = await requireSpace("admin");
  const today = dakarIsoDate();

  // Chaque section se charge à part : une erreur dans l'une n'empêche pas les autres.
  const [pedagogy, hr, maintenance] = await Promise.all([
    allows("pedagogy", role) ? loadPedagogyDashboard(today) : null,
    allows("hr", role) ? loadHrDashboard() : null,
    allows("maintenance", role) ? loadMaintenanceDashboard(today) : null,
  ]);

  return (
    <main className="flex w-full flex-col gap-8 p-4 sm:p-8">
      <PageHeader
        eyebrow="Vue d'ensemble"
        title="Tableau de bord"
        description="Les chiffres clés de votre domaine : la situation d'aujourd'hui et l'évolution des dernières semaines."
      />

      {pedagogy && <PedagogySection data={pedagogy} />}
      {hr && <HrSection data={hr} />}
      {maintenance && <MaintenanceSection data={maintenance} />}
    </main>
  );
}

function SectionHeader({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <Button key={link.href} variant="outline" size="sm" asChild>
            <Link href={link.href}>
              {link.label}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}

function SectionError({ message }: { message: string }) {
  return (
    <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
      {message}
    </p>
  );
}

function PedagogySection({
  data,
}: {
  data: PedagogyDashboard | { error: string };
}) {
  return (
    <section aria-label="Pédagogie" className="flex flex-col gap-4">
      <SectionHeader
        title="Pédagogie"
        links={[
          { href: "/admin/pointages", label: "Pointages" },
          { href: "/admin/rapports", label: "Rapports" },
          { href: "/admin/bilans", label: "Bilans" },
        ]}
      />
      {"error" in data ? (
        <SectionError message={data.error} />
      ) : (
        <PedagogyContent data={data} />
      )}
    </section>
  );
}

function PedagogyContent({ data }: { data: PedagogyDashboard }) {
  const todayLine = data.attendance[data.attendance.length - 1] ?? [0, 0, 0];
  const todayTotal = todayLine.reduce((sum, n) => sum + n, 0);
  const validatedThisWeek = data.reports[data.reports.length - 1]?.[0] ?? 0;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          value={String(todayTotal)}
          label="Pointages aujourd'hui"
          hint={`${todayLine[0] ?? 0} à l'heure · ${todayLine[1] ?? 0} en retard · ${todayLine[2] ?? 0} à vérifier`}
        />
        <StatTile
          value={String(data.reportsToTreat)}
          label="Rapports à traiter"
          hint="Envoyés, en attente d'une décision"
        />
        <StatTile
          value={String(validatedThisWeek)}
          label="Rapports validés"
          hint="Cette semaine"
        />
        <StatTile
          value={String(data.draftBilans)}
          label="Bilans en brouillon"
          hint="À relire puis publier"
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ColumnChart
          title="Pointages des 14 derniers jours"
          description="Un pointage par formateur, créneau et jour."
          categories={data.days.map((day) => ({
            label: dayLabel(day),
            axisLabel: shortDate(day),
          }))}
          series={ATTENDANCE_SERIES}
          values={data.attendance}
          unit="pointages"
          emptyText="Aucun pointage sur les 14 derniers jours."
        />
        <ColumnChart
          title="Rapports des 8 dernières semaines"
          description="Rapports envoyés par les formateurs, selon la décision de la Direction."
          categories={data.weeks.map((week) => ({
            label: `Semaine du ${dayLabel(week)}`,
            axisLabel: shortDate(week),
          }))}
          series={REPORT_SERIES}
          values={data.reports}
          unit="rapports"
          emptyText="Aucun rapport envoyé sur les 8 dernières semaines."
        />
      </div>
    </>
  );
}

function HrSection({ data }: { data: HrDashboard | { error: string } }) {
  return (
    <section aria-label="Ressources humaines" className="flex flex-col gap-4">
      <SectionHeader
        title="Ressources humaines"
        links={[{ href: "/admin/personnel", label: "Personnel" }]}
      />
      {"error" in data ? (
        <SectionError message={data.error} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              value={String(data.activeTotal)}
              label="Personnel actif"
            />
            <StatTile
              value={String(data.pendingInvitations)}
              label="Invitations en attente"
              hint="Comptes pas encore activés"
            />
            <StatTile
              value={String(data.documentsToCheck)}
              label="Documents à vérifier"
              hint="Dossiers administratifs"
            />
          </div>
          <BarList
            title="Personnel actif par rôle"
            rows={data.byRole.map((row) => ({
              label: row.label,
              value: row.count,
            }))}
            emptyText="Aucun compte actif pour le moment."
          />
        </>
      )}
    </section>
  );
}

function MaintenanceSection({
  data,
}: {
  data: MaintenanceDashboard | { error: string };
}) {
  return (
    <section aria-label="Maintenance" className="flex flex-col gap-4">
      <SectionHeader
        title="Maintenance"
        links={[
          { href: "/admin/maintenance", label: "Tickets" },
          { href: "/admin/parc", label: "Parc informatique" },
        ]}
      />
      {"error" in data ? (
        <SectionError message={data.error} />
      ) : (
        <MaintenanceContent data={data} />
      )}
    </section>
  );
}

function MaintenanceContent({ data }: { data: MaintenanceDashboard }) {
  const { stats } = data;
  const average = stats.averageResolutionMs;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          value={String(stats.toTreat)}
          label="À traiter"
          hint="Ouverts, pas encore pris en charge"
        />
        <StatTile value={String(stats.inProgress)} label="En cours" />
        <StatTile
          value={String(stats.resolvedRecently)}
          label="Résolus"
          hint={`Sur les ${RECENT_DAYS} derniers jours`}
        />
        <StatTile
          value={average === null ? "—" : formatDuration(average)}
          label="Délai moyen"
          hint={
            average === null
              ? "Aucune résolution récente"
              : "De l'ouverture à la résolution"
          }
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ColumnChart
          title="Tickets ouverts par semaine"
          description="Pannes signalées dans les rapports, sur les 8 dernières semaines."
          categories={data.weeks.map((week) => ({
            label: `Semaine du ${dayLabel(week)}`,
            axisLabel: shortDate(week),
          }))}
          series={[{ label: "Tickets ouverts", color: "chart-1" }]}
          values={data.opened}
          unit="tickets"
          emptyText="Aucun ticket ouvert sur les 8 dernières semaines."
        />
        <BarList
          title="Pannes en cours par école"
          description="Tickets à traiter ou en cours."
          rows={data.bySchool}
          emptyText="Aucune panne en cours."
        />
      </div>
    </>
  );
}
