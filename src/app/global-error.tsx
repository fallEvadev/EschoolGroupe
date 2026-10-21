"use client";

/**
 * Dernier filet de sécurité : s'affiche si la structure même de l'application
 * (le gabarit racine) plante. Ce fichier remplace tout le document, donc il
 * définit ses propres balises et ne dépend ni de Tailwind ni des composants de
 * l'application.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          fontFamily: "system-ui, sans-serif",
          colorScheme: "light dark",
        }}
      >
        <title>Erreur · E-School</title>
        <main style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>
            Une erreur est survenue
          </h1>
          <p style={{ margin: "0 0 16px", lineHeight: 1.5 }}>
            L&apos;application n&apos;a pas pu s&apos;afficher. Vérifiez votre
            connexion puis réessayez. Si le problème continue, prévenez
            l&apos;administration.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              minHeight: 48,
              padding: "0 20px",
              fontSize: 16,
              borderRadius: 8,
              border: "1px solid currentColor",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
          {error.digest && (
            <p style={{ fontSize: 12, opacity: 0.7 }}>
              Code de l&apos;erreur : {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
