import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { parseRole } from "@/lib/auth/roles";
import { BILANS_BUCKET } from "@/lib/bilan-pdf";
import { createServerSupabase } from "@/lib/supabase/server";

/** Durée de validité du lien vers le PDF : 60 secondes. */
const LINK_SECONDS = 60;

/**
 * Télécharge le PDF d'un bilan publié de l'école du directeur. Triple contrôle :
 * le rôle est vérifié ici, la fonction SQL `partner_bilan_file` ne répond que
 * pour un bilan publié d'une école du directeur, puis la règle de stockage
 * revérifie la même condition au moment de signer le lien.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId, sessionClaims } = await auth();
  const role = parseRole(sessionClaims?.user_role);
  if (!userId || role !== "directeur_partenaire") {
    return new Response("Accès refusé.", { status: 403 });
  }

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return new Response("Bilan introuvable.", { status: 404 });
  }

  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc("partner_bilan_file", {
      p_bilan_id: id,
    });
    if (error) {
      console.error("partner_bilan_file :", error.message);
      return new Response("Une erreur est survenue.", { status: 500 });
    }
    // Brouillon, autre école ou bilan inexistant : même réponse, aucune fuite.
    const file = data[0];
    if (!file) return new Response("Bilan introuvable.", { status: 404 });

    const { data: signed, error: signedError } = await supabase.storage
      .from(BILANS_BUCKET)
      .createSignedUrl(file.out_path, LINK_SECONDS, {
        download: file.out_file_name ?? true,
      });
    if (signedError) {
      console.error("storage :", signedError.message);
      return new Response("Une erreur est survenue.", { status: 500 });
    }
    return NextResponse.redirect(signed.signedUrl, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("bilan partenaire :", error);
    return new Response("Une erreur est survenue.", { status: 500 });
  }
}
