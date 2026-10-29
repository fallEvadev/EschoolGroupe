import { Clock, KeyRound, MessageCircle } from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireSpace } from "@/lib/auth/guards";
import { formatCode } from "@/lib/daily-codes";
import { formatDate, formatLongDate } from "@/lib/dates";
import { getOwnProfileId } from "@/lib/internal-rules";
import { formatTime } from "@/lib/schools";
import { describeSupabaseError } from "@/lib/supabase/errors";
import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { buildWhatsAppUrl, trainersCodeMessage } from "@/lib/whatsapp";

import { DeputiesCard, type DeputyView } from "./deputies-card";
import {
  SchoolPositionCard,
  type SchoolPositionInfo,
} from "./school-position-card";

export const metadata = { title: "Code de descente · E-School" };

type PartnerSchool = {
  id: string;
  name: string;
  address: string | null;
  /** Le code du jour, seulement une fois le premier cours terminé ; sinon `null`. */
  code: string | null;
  /** Un code existe pour aujourd'hui (même s'il n'est pas encore montré). */
  hasCode: boolean;
  /** Fin du premier cours d'aujourd'hui (« HH:MM »), `null` s'il n'y a aucun cours. */
  firstEnd: string | null;
  position: SchoolPositionInfo;
  /** Adjoint : il voit le code mais n'invite personne ni ne fixe la position. */
  isDeputy: boolean;
  /** Adjoints de l'école (vide pour un adjoint). */
  deputies: DeputyView[];
};

/**
 * Écoles du directeur connecté et leur code du jour. Lues avec SON jeton : la
 * RLS ne lui montre que ses écoles. Le code, lui, ne vient PAS de la table : la
 * fonction SQL `partner_codes_today` ne le donne qu'à partir de la fin du
 * premier cours du jour (il le donne aux formateurs une fois leur cours terminé).
 * On filtre aussi sur sa fiche, car un Super-Admin verrait sinon toutes les écoles.
 */
async function loadMySchools(): Promise<
  { schools: PartnerSchool[] } | { error: string }
> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Le service n'est pas encore configuré. Contactez l'administrateur technique.",
    };
  }
  const profileId = await getOwnProfileId();
  if (!profileId) return { schools: [] };

  const supabase = await createServerSupabase();
  const links = await supabase
    .from("school_directors")
    .select("school_id, is_deputy")
    .eq("profile_id", profileId)
    .eq("status", "actif");
  if (links.error) {
    return {
      error: describeSupabaseError("school_directors", links.error).message,
    };
  }
  const schoolIds = links.data.map((link) => link.school_id);
  if (schoolIds.length === 0) return { schools: [] };
  const deputyOf = new Map(
    links.data.map((link) => [link.school_id, link.is_deputy]),
  );

  const [schoolsResult, codesResult, deputiesResult] = await Promise.all([
    supabase
      .from("schools")
      .select(
        "id, name, address, latitude, longitude, position_source, position_set_at",
      )
      .in("id", schoolIds)
      .eq("status", "actif")
      .order("name"),
    supabase.rpc("partner_codes_today"),
    // Les adjoints de SES écoles seulement : la base filtre sur l'appelant.
    supabase.rpc("my_deputies"),
  ]);
  if (schoolsResult.error) {
    return {
      error: describeSupabaseError("schools", schoolsResult.error).message,
    };
  }
  if (codesResult.error) {
    return {
      error: describeSupabaseError("partner_codes_today", codesResult.error)
        .message,
    };
  }

  // Les adjoints sont un plus : si leur liste est indisponible, le code reste affiché.
  const deputies = deputiesResult.error ? [] : deputiesResult.data;
  const codes = new Map(
    codesResult.data.map((row) => [row.out_school_id, row]),
  );
  return {
    schools: schoolsResult.data.map((school) => ({
      id: school.id,
      name: school.name,
      address: school.address,
      code: codes.get(school.id)?.out_code ?? null,
      hasCode: codes.get(school.id)?.out_has_code ?? false,
      firstEnd: codes.get(school.id)?.out_first_end ?? null,
      isDeputy: deputyOf.get(school.id) ?? false,
      deputies: deputies
        .filter((row) => row.school_id === school.id)
        .map((row) => ({
          profileId: row.profile_id,
          fullName: row.full_name,
          status: row.profile_status,
        })),
      position: {
        defined: school.latitude !== null && school.longitude !== null,
        setOn: school.position_set_at
          ? formatDate(school.position_set_at)
          : null,
        setBy:
          school.position_source === "directeur"
            ? "par le directeur"
            : school.position_source === "admin"
              ? "par la Direction pédagogique"
              : null,
      },
    })),
  };
}

export default async function PartenairePage() {
  await requireSpace("partenaire");
  const dateLabel = formatLongDate(new Date());
  const loaded = await loadMySchools();

  return (
    <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Espace partenaire"
        title="Code de descente"
        description={
          <>
            Code de descente de <strong>{dateLabel}</strong>. Il s&apos;affiche
            à la fin du premier cours : donnez-le aux formateurs une fois leur
            cours terminé, pas avant. Il ne sert qu&apos;aujourd&apos;hui.
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
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={school.code ? "success" : "warning"}>
                      {school.code
                        ? "Code de descente"
                        : school.hasCode
                          ? "Pas encore"
                          : "Pas de code"}
                    </Badge>
                    {school.isDeputy && (
                      <Badge variant="neutral">Adjoint</Badge>
                    )}
                  </div>
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
                ) : school.hasCode && school.firstEnd ? (
                  <p className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Clock className="size-4 shrink-0" aria-hidden />
                    Le code s&apos;affichera à {formatTime(school.firstEnd)}, à
                    la fin du premier cours.
                  </p>
                ) : school.hasCode ? (
                  <p className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Clock className="size-4 shrink-0" aria-hidden />
                    Aucun cours n&apos;est prévu aujourd&apos;hui dans votre
                    école.
                  </p>
                ) : (
                  <p className="text-muted-foreground flex items-center gap-2 text-sm">
                    <KeyRound className="size-4 shrink-0" aria-hidden />
                    La Direction pédagogique n&apos;a pas encore généré le code
                    du jour. Revenez dans un instant.
                  </p>
                )}

                {!school.isDeputy && (
                  <>
                    <SchoolPositionCard
                      schoolId={school.id}
                      schoolName={school.name}
                      position={school.position}
                    />
                    <DeputiesCard
                      schoolId={school.id}
                      deputies={school.deputies}
                    />
                  </>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
