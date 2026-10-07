import { KeyRound, MessageCircle } from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireSpace } from "@/lib/auth/guards";
import { formatCode } from "@/lib/daily-codes";
import { dakarIsoDate, formatLongDate } from "@/lib/dates";
import { getOwnProfileId } from "@/lib/internal-rules";
import { describeSupabaseError } from "@/lib/supabase/errors";
import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { buildWhatsAppUrl, trainersCodeMessage } from "@/lib/whatsapp";

export const metadata = { title: "Codes du jour · E-School Groupe" };

type PartnerSchool = {
  id: string;
  name: string;
  address: string | null;
  code: string | null;
};

/**
 * Écoles du directeur connecté et leur code du jour. Lu avec SON jeton : la RLS
 * ne lui montre que ses écoles et leurs codes. On filtre aussi sur sa fiche,
 * car un Super-Admin verrait sinon toutes les écoles.
 */
async function loadMySchools(
  today: string,
): Promise<{ schools: PartnerSchool[] } | { error: string }> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Configuration Supabase incomplète : vérifiez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local.",
    };
  }
  const profileId = await getOwnProfileId();
  if (!profileId) return { schools: [] };

  const supabase = await createServerSupabase();
  const links = await supabase
    .from("school_directors")
    .select("school_id")
    .eq("profile_id", profileId)
    .eq("status", "actif");
  if (links.error) {
    return {
      error: describeSupabaseError("school_directors", links.error).message,
    };
  }
  const schoolIds = links.data.map((link) => link.school_id);
  if (schoolIds.length === 0) return { schools: [] };

  const [schoolsResult, codesResult] = await Promise.all([
    supabase
      .from("schools")
      .select("id, name, address")
      .in("id", schoolIds)
      .eq("status", "actif")
      .order("name"),
    supabase
      .from("daily_codes")
      .select("school_id, code")
      .in("school_id", schoolIds)
      .eq("code_date", today)
      .eq("status", "actif"),
  ]);
  if (schoolsResult.error) {
    return {
      error: describeSupabaseError("schools", schoolsResult.error).message,
    };
  }
  if (codesResult.error) {
    return {
      error: describeSupabaseError("daily_codes", codesResult.error).message,
    };
  }

  const codes = new Map(
    codesResult.data.map((row) => [row.school_id, row.code]),
  );
  return {
    schools: schoolsResult.data.map((school) => ({
      id: school.id,
      name: school.name,
      address: school.address,
      code: codes.get(school.id) ?? null,
    })),
  };
}

export default async function PartenairePage() {
  await requireSpace("partenaire");
  const dateLabel = formatLongDate(new Date());
  const loaded = await loadMySchools(dakarIsoDate());

  return (
    <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Espace partenaire"
        title="Codes du jour"
        description={
          <>
            Code de pointage de <strong>{dateLabel}</strong>. Donnez-le
            uniquement aux formateurs présents aujourd&apos;hui dans votre école
            : il ne sert qu&apos;aujourd&apos;hui.
          </>
        }
      />

      {"error" in loaded ? (
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {loaded.error}
        </p>
      ) : loaded.schools.length === 0 ? (
        <Card className="p-4 sm:p-6">
          <p className="text-muted-foreground">
            Aucune école n&apos;est rattachée à votre compte. Contactez la
            Direction pédagogique.
          </p>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {loaded.schools.map((school) => (
            <li key={school.id}>
              <Card className="flex h-full flex-col gap-4 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold">
                      {school.name}
                    </h2>
                    <p className="text-muted-foreground truncate text-sm">
                      {school.address ?? "Adresse non renseignée"}
                    </p>
                  </div>
                  <Badge variant={school.code ? "success" : "warning"}>
                    {school.code ? "Code du jour" : "Pas encore de code"}
                  </Badge>
                </div>

                {school.code ? (
                  <>
                    <p
                      className="font-heading text-5xl font-extrabold tracking-[0.15em] tabular-nums"
                      aria-label={`Code ${school.code.split("").join(" ")}`}
                    >
                      {formatCode(school.code)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <CopyButton value={school.code} />
                      <Button variant="whatsapp" size="sm" asChild>
                        <a
                          href={buildWhatsAppUrl(
                            null,
                            trainersCodeMessage({
                              schoolName: school.name,
                              dateLabel,
                              code: formatCode(school.code),
                            }),
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageCircle aria-hidden />
                          Partager par WhatsApp
                        </a>
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground flex items-center gap-2 text-sm">
                    <KeyRound className="size-4 shrink-0" aria-hidden />
                    La Direction pédagogique n&apos;a pas encore généré le code
                    du jour. Revenez dans un instant.
                  </p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
