import { NextResponse } from "next/server";

import { checkHealth } from "@/lib/health";

export const dynamic = "force-dynamic";

/**
 * Contrôle de santé, appelé toutes les 15 minutes par le robot de surveillance
 * (GitHub Actions, `.github/workflows/surveillance.yml`). Route publique : elle
 * répond seulement « ok / pas ok » et le temps de réponse de la base, jamais
 * une clé, une adresse ou un message d'erreur.
 */
export async function GET() {
  const report = await checkHealth({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  return NextResponse.json(report, {
    status: report.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
