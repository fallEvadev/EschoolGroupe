import { SignUp } from "@clerk/nextjs";

export const metadata = { title: "Activer mon compte · E-School Groupe" };

/**
 * Activation du compte d'une recrue : le lien de l'invitation envoyée par
 * les RH ouvre cette page (le jeton d'invitation est lu par Clerk).
 */
export default function ActivationPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">Activer mon compte</h1>
        <p className="text-muted-foreground">
          Choisissez votre mot de passe pour accéder à la plateforme E-School
          Groupe.
        </p>
      </div>
      <SignUp signInUrl="/connexion" />
    </main>
  );
}
