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
import { ORG_ASSETS_BUCKET } from "@/lib/org-assets";
import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import {
  describeSupabaseError,
  SUPABASE_ISSUE_MESSAGES,
} from "@/lib/supabase/errors";

import { AssetsCard, type AssetUrls } from "./assets-card";
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

/** Durée de validité des adresses d'aperçu : 10 minutes. */
const PREVIEW_SECONDS = 600;

/**
 * Adresses signées temporaires du logo et de la signature (stockage privé).
 * Une erreur ne casse pas la page : l'image est simplement absente.
 */
async function loadAssetUrls(): Promise<AssetUrls> {
  const urls: AssetUrls = { logo: null, signature: null };
  if (!isSupabaseConfigured()) return urls;

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("organization_settings")
    .select("logo_path, signature_path")
    .maybeSingle();
  if (!data) return urls;

  for (const [kind, path] of [
    ["logo", data.logo_path],
    ["signature", data.signature_path],
  ] as const) {
    if (!path) continue;
    const { data: signed } = await supabase.storage
      .from(ORG_ASSETS_BUCKET)
      .createSignedUrl(path, PREVIEW_SECONDS);
    urls[kind] = signed?.signedUrl ?? null;
  }
  return urls;
}

export default async function ParametresPage() {
  // Second verrou : l'espace admin ne suffit pas, il faut être Super-Admin.
  const role = await requireSpace("admin");
  if (role !== "super_admin") redirect("/non-autorise");

  const [result, assetUrls] = await Promise.all([
    loadSettings(),
    loadAssetUrls(),
  ]);

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
          <CardTitle>Logo et signature</CardTitle>
          <CardDescription>
            Images ajoutées aux bilans envoyés aux écoles partenaires. PNG ou
            JPEG, 500 Ko au maximum.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AssetsCard urls={assetUrls} />
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
