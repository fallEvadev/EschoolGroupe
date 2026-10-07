import { KeyRound, MessageCircle } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCode } from "@/lib/daily-codes";
import { dakarIsoDate, formatLongDate } from "@/lib/dates";
import { directorsBySchool, type DirectorContact } from "@/lib/schools";
import { splitFullName } from "@/lib/staff";
import { describeSupabaseError } from "@/lib/supabase/errors";
import {
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { buildWhatsAppUrl, directorCodeMessage } from "@/lib/whatsapp";

import { loadStaffDirectory, requirePedagogyManager } from "../ecoles/access";
import { CodeActions, GenerateCodesButton } from "./codes-actions";

export const metadata = { title: "Codes du jour · E-School Groupe" };

type SchoolCode = {
  id: string;
  name: string;
  address: string | null;
  code: string | null;
  directors: DirectorContact[];
};

type Loaded =
  | {
      schools: SchoolCode[];
      /** Message si l'annuaire des directeurs est indisponible, sinon `null`. */
      directoryError: string | null;
    }
  | { error: string };

async function loadCodes(today: string): Promise<Loaded> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Configuration Supabase incomplète : vérifiez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local.",
    };
  }
  // Client avec le jeton de l'utilisateur : la RLS réserve la lecture des
  // codes à la Direction pédagogique et aux directeurs de l'école.
  const supabase = await createServerSupabase();

  const [schoolsResult, codesResult, linksResult, directory] =
    await Promise.all([
      supabase
        .from("schools")
        .select("id, name, address")
        .eq("status", "actif")
        .order("name"),
      supabase
        .from("daily_codes")
        .select("school_id, code")
        .eq("code_date", today)
        .eq("status", "actif"),
      supabase
        .from("school_directors")
        .select("school_id, profile_id")
        .eq("status", "actif"),
      loadStaffDirectory(supabase),
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

  // Les directeurs sont un plus : si leur liste est indisponible, les codes
  // restent utilisables (copie), sans les boutons d'envoi.
  let directors = new Map<string, DirectorContact[]>();
  let directoryError: string | null = null;
  if ("error" in directory) {
    directoryError = directory.error;
  } else if (linksResult.error) {
    directoryError = describeSupabaseError(
      "school_directors",
      linksResult.error,
    ).message;
  } else {
    const people = new Map<string, DirectorContact>(
      directory.staff
        .filter(
          (person) =>
            person.role === "directeur_partenaire" && person.status === "actif",
        )
        .map((person) => [
          person.id,
          { id: person.id, fullName: person.fullName, phone: person.phone },
        ]),
    );
    directors = directorsBySchool(
      linksResult.data.map((link) => ({
        schoolId: link.school_id,
        profileId: link.profile_id,
      })),
      people,
    );
  }

  const codes = new Map(
    codesResult.data.map((row) => [row.school_id, row.code]),
  );
  return {
    directoryError,
    schools: schoolsResult.data.map((school) => ({
      id: school.id,
      name: school.name,
      address: school.address,
      code: codes.get(school.id) ?? null,
      directors: directors.get(school.id) ?? [],
    })),
  };
}

export default async function CodesPage() {
  await requirePedagogyManager();
  const today = dakarIsoDate();
  const dateLabel = formatLongDate(new Date());
  const loaded = await loadCodes(today);

  const missing =
    "schools" in loaded
      ? loaded.schools.filter((school) => school.code === null).length
      : 0;

  return (
    <main className="flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-8">
      <PageHeader
        eyebrow="Pilotage pédagogique"
        title="Codes du jour"
        description={
          <>
            Codes de pointage de <strong>{dateLabel}</strong>, un par école.
            Envoyez chaque code uniquement au directeur de l&apos;école : il le
            donne aux formateurs présents.
          </>
        }
        actions={
          "schools" in loaded && loaded.schools.length > 0 ? (
            <GenerateCodesButton missing={missing} />
          ) : undefined
        }
      />

      {"error" in loaded ? (
        <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
          {loaded.error}
        </p>
      ) : loaded.schools.length === 0 ? (
        <Card className="flex flex-col items-start gap-3 p-6">
          <p className="text-muted-foreground">
            Aucune école active : il n&apos;y a pas de code à générer.
          </p>
          <Button asChild>
            <Link href="/admin/ecoles/nouveau">Ajouter une école</Link>
          </Button>
        </Card>
      ) : (
        <>
          {loaded.directoryError && (
            <p className="bg-warning-soft text-warning rounded-lg p-3 text-sm">
              Les directeurs ne peuvent pas être listés :{" "}
              {loaded.directoryError} Les codes restent utilisables, mais sans
              les boutons d&apos;envoi.
            </p>
          )}
          <p className="text-muted-foreground text-sm tabular-nums">
            {loaded.schools.length - missing} / {loaded.schools.length} écoles
            ont un code aujourd&apos;hui.
          </p>
          <Stagger as="ul" className="grid gap-4 sm:grid-cols-2">
            {loaded.schools.map((school) => (
              <StaggerItem as="li" key={school.id}>
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
                      {school.code ? "Code prêt" : "Pas de code"}
                    </Badge>
                  </div>

                  {school.code ? (
                    <p
                      className="font-heading text-4xl font-extrabold tracking-[0.15em] tabular-nums"
                      aria-label={`Code ${school.code.split("").join(" ")}`}
                    >
                      {formatCode(school.code)}
                    </p>
                  ) : (
                    <p className="text-muted-foreground flex items-center gap-2 text-sm">
                      <KeyRound className="size-4" aria-hidden />
                      Cliquez sur « Générer les codes du jour ».
                    </p>
                  )}

                  <CodeActions
                    schoolId={school.id}
                    schoolName={school.name}
                    code={school.code}
                  />

                  {school.code && !loaded.directoryError && (
                    <DirectorsSend
                      schoolId={school.id}
                      schoolName={school.name}
                      code={school.code}
                      dateLabel={dateLabel}
                      directors={school.directors}
                    />
                  )}
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
        </>
      )}
    </main>
  );
}

/** Boutons d'envoi du code aux directeurs de l'école (lien WhatsApp déjà rempli). */
function DirectorsSend({
  schoolId,
  schoolName,
  code,
  dateLabel,
  directors,
}: {
  schoolId: string;
  schoolName: string;
  code: string;
  dateLabel: string;
  directors: DirectorContact[];
}) {
  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <h3 className="text-primary text-xs font-semibold tracking-[0.12em] uppercase">
        Envoyer au directeur
      </h3>

      {directors.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucun directeur n&apos;est rattaché à cette école.{" "}
          <Link
            href={`/admin/ecoles?ecole=${schoolId}`}
            className="text-primary font-medium hover:underline"
          >
            Rattacher un directeur
          </Link>
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {directors.map((director) => {
            const firstName =
              splitFullName(director.fullName).firstName || director.fullName;
            const message = directorCodeMessage({
              firstName,
              schoolName,
              dateLabel,
              code: formatCode(code),
            });
            return (
              <li key={director.id} className="flex flex-col gap-1">
                <Button variant="whatsapp" asChild className="w-fit">
                  <a
                    href={buildWhatsAppUrl(director.phone, message)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle aria-hidden />
                    Envoyer à {director.fullName}
                  </a>
                </Button>
                {!director.phone && (
                  <p className="text-muted-foreground text-xs">
                    Numéro non renseigné : choisissez le contact dans WhatsApp,
                    ou ajoutez le numéro dans « Personnel ».
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
