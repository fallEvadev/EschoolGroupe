import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { parseRole } from "@/lib/auth/roles";
import { loadBilanDocument } from "@/lib/bilan-document-data";
import { buildBilanDocx } from "@/lib/exports/bilan-docx";

const WORD_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Télécharge le fichier Word d'un bilan. Double contrôle : le rôle est vérifié
 * ici (le proxy protège déjà /admin/bilans), puis la lecture des données se
 * fait avec le jeton de l'utilisateur, donc sous la RLS.
 */
export async function GET(
  _request: Request,
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
    const loaded = await loadBilanDocument(id);
    if (loaded === null)
      return new Response("Bilan introuvable.", { status: 404 });
    if ("error" in loaded) {
      return new Response(loaded.error, { status: 500 });
    }

    const file = await buildBilanDocx(loaded.data);
    return new Response(file.slice().buffer, {
      headers: {
        "Content-Type": WORD_MIME,
        "Content-Disposition": `attachment; filename="${loaded.fileName}"`,
        // Document interne : jamais mis en cache par un intermédiaire.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("bilan word :", error);
    return new Response("Le document n'a pas pu être généré.", { status: 500 });
  }
}
