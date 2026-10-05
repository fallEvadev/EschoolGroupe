import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSpace } from "@/lib/auth/guards";
import {
  createAdminSupabase,
  isAdminSupabaseConfigured,
} from "@/lib/supabase/admin";

import { AuditLogList } from "./audit-log-list";
import { OrganizationForm } from "./organization-form";

export const metadata = { title: "Paramètres · E-School Groupe" };

/** Codes renvoyés quand la table n'existe pas encore (migration non appliquée). */
const TABLE_MISSING_CODES = new Set(["PGRST205", "42P01"]);

/** Message affiché à la place du formulaire quand il ne peut pas être chargé. */
const UNAVAILABLE_MESSAGES = {
  config:
    "Configuration Supabase incomplète : vérifiez NEXT_PUBLIC_SUPABASE_URL (doit commencer par https://) et SUPABASE_SERVICE_ROLE_KEY dans .env.local.",
  migration:
    "La table « organization_settings » n'existe pas encore : la migration doit être appliquée sur Supabase (npx supabase db push).",
  error: "Paramètres indisponibles pour le moment. Réessayez dans un instant.",
};

type SettingsLoad =
  | {
      settings: {
        organization_name: string;
        academic_year: string;
        current_semester: number;
      };
    }
  | { unavailable: keyof typeof UNAVAILABLE_MESSAGES };

async function loadSettings(): Promise<SettingsLoad> {
  // Configuration invalide : message à l'écran, sans erreur dans la console.
  if (!isAdminSupabaseConfigured()) return { unavailable: "config" };

  const { data, error } = await createAdminSupabase()
    .from("organization_settings")
    .select("organization_name, academic_year, current_semester")
    .maybeSingle();

  if (error) {
    if (TABLE_MISSING_CODES.has(error.code)) {
      return { unavailable: "migration" };
    }
    console.error("organization_settings :", error.message);
    return { unavailable: "error" };
  }
  if (!data) return { unavailable: "migration" };
  return { settings: data };
}

export default async function ParametresPage() {
  // Second verrou : l'espace admin ne suffit pas, il faut être Super-Admin.
  const role = await requireSpace("admin");
  if (role !== "super_admin") redirect("/non-autorise");

  const result = await loadSettings();

  return (
    <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Organisation · Super-Admin"
        title="Paramètres"
        description="Informations de l'organisation et journal des actions sensibles."
      />

      <Card>
        <CardHeader>
          <CardTitle>Organisation</CardTitle>
          <CardDescription>
            Nom, année scolaire et semestre affichés sur la plateforme.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {"settings" in result ? (
            <OrganizationForm
              initial={{
                organizationName: result.settings.organization_name,
                academicYear: result.settings.academic_year,
                currentSemester: result.settings.current_semester,
              }}
            />
          ) : (
            <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
              {UNAVAILABLE_MESSAGES[result.unavailable]}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Journal d&apos;audit</CardTitle>
          <CardDescription>
            Changements de rôle, désactivations et modifications des paramètres.
            Le journal ne peut être ni modifié ni effacé.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuditLogList />
        </CardContent>
      </Card>
    </main>
  );
}
