import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCurrentRole } from "@/lib/auth/guards";
import { homeForRole } from "@/lib/auth/roles";
import { formatDate } from "@/lib/dates";
import { getCurrentRules, hasAcceptedRules } from "@/lib/internal-rules";

import { AcceptRulesForm } from "./accept-rules-form";

export const metadata = { title: "Règlement intérieur · E-School Groupe" };

/**
 * Lecture et acceptation du règlement intérieur. Accessible à toute personne
 * connectée (le proxy exige la connexion) ; les formateurs et maintenanciers
 * y sont envoyés tant qu'ils n'ont pas accepté la version en vigueur.
 */
export default async function ReglementPage() {
  const role = await getCurrentRole();
  const homeHref = role ? homeForRole(role) : "/";

  const rules = await getCurrentRules();
  const accepted = rules ? await hasAcceptedRules(rules.id) : false;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <header>
        <Brand className="text-navy" />
      </header>

      {!rules ? (
        <Card className="flex flex-col gap-4 p-4 sm:p-6">
          <h1 className="text-2xl font-bold">Règlement intérieur</h1>
          <p className="text-muted-foreground">
            Aucun règlement n&apos;est publié pour le moment.
          </p>
          <div>
            <Button asChild>
              <Link href={homeHref}>Continuer</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <p className="text-primary text-xs font-semibold tracking-[0.12em] uppercase">
              Version {rules.version} · publiée le {formatDate(rules.publishedAt)}
            </p>
            <h1 className="text-2xl font-extrabold sm:text-4xl">
              {rules.title}
            </h1>
          </div>

          <Card className="p-4 sm:p-6">
            {/* Texte brut : les retours à la ligne sont conservés, rien n'est interprété. */}
            <div className="leading-relaxed break-words whitespace-pre-wrap">
              {rules.content}
            </div>
          </Card>

          <Card className="p-4 sm:p-6">
            {accepted ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2
                    className="text-success mt-0.5 size-6 shrink-0"
                    aria-hidden
                  />
                  <p className="font-medium">
                    Vous avez accepté cette version du règlement.
                  </p>
                </div>
                <div>
                  <Button asChild variant="outline">
                    <Link href={homeHref}>Retour à la plateforme</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <AcceptRulesForm rulesId={rules.id} homeHref={homeHref} />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
