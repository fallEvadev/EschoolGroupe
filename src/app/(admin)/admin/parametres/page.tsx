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
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import {
  describeSupabaseError,
  SUPABASE_ISSUE_MESSAGES,
} from "@/lib/supabase/errors";

import { AuditLogList } from "./audit-log-list";
import { OrganizationForm } from "./organization-form";

export const metadata = { title: "Paramètres · E-School Groupe" };

/** Configuration Supabase absente (variables d'environnement). */
const CONFIG_MESSAGE =
  "Configuration Supabase incomplète : vérifiez NEXT_PUBLIC_SUPABASE_URL (doit commencer par https://) et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local.";

type SettingsLoad =
  | {
      settings: {
        organization_name: string;
        academic_year: string;
        current_semester: number;
      };
    }
  | { unavailable: string };

async function loadSettings(): Promise<SettingsLoad> {
  // Configuration invalide : message à l'écran, sans erreur dans la console.
  if (!isSupabaseConfigured()) return { unavailable: CONFIG_MESSAGE };

  // Client avec le jeton de l'utilisateur : la RLS s'applique.
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("organization_settings")
    .select("organization_name, academic_year, current_semester")
    .maybeSingle();

  if (error) {
    return {
      unavailable: describeSupabaseError("organization_settings", error)
        .message,
    };
  }
  if (!data) return { unavailable: SUPABASE_ISSUE_MESSAGES.migration };
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
              {result.unavailable}
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
