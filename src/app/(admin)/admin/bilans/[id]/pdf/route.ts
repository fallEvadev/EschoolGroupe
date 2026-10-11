import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { parseRole } from "@/lib/auth/roles";
import { BILANS_BUCKET } from "@/lib/bilan-pdf";
import { createServerSupabase } from "@/lib/supabase/server";

/** Durée de validité du lien vers le PDF : 60 secondes. */
const LINK_SECONDS = 60;

/**
 * Ouvre le PDF final d'un bilan. Double contrôle : le rôle est vérifié ici (le
 * proxy protège déjà /admin/bilans), puis le lien est demandé au stockage avec le
 * jeton de l'utilisateur, donc sous la RLS. L'adresse signée est à usage court.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId, sessionClaims } = await auth();
  const role = parseRole(sessionClaims?.user_role);
  if (!userId || (role !== "admin_pedagogie" && role !== "super_admin")) {
    return new Response("Accès refusé.", { status: 403 });
  }

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return new Response("Bilan introuvable.", { status: 404 });
  }

  try {
    const supabase = await createServerSupabase();
    const { data: bilan, error } = await supabase
      .from("bilans")
      .select("pdf_path, pdf_file_name")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("bilans :", error.message);
      return new Response("Une erreur est survenue.", { status: 500 });
    }
    if (!bilan?.pdf_path) {
      return new Response("Ce bilan n'a pas encore de PDF final.", {
        status: 404,
      });
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from(BILANS_BUCKET)
      .createSignedUrl(bilan.pdf_path, LINK_SECONDS, {
        download: bilan.pdf_file_name ?? true,
      });
    if (signedError) {
      console.error("storage :", signedError.message);
      return new Response("Une erreur est survenue.", { status: 500 });
    }
    return NextResponse.redirect(signed.signedUrl, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("bilan pdf :", error);
    return new Response("Une erreur est survenue.", { status: 500 });
  }
}
