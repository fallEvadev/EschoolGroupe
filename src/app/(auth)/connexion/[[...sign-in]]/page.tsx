import { SignIn } from "@clerk/nextjs";

export default function ConnexionPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <SignIn />
    </main>
  );
}
