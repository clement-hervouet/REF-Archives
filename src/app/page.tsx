import { fr } from "@/i18n/fr";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">{fr.app.name}</h1>
      <p className="mt-2 text-neutral-600">{fr.app.tagline}</p>
    </main>
  );
}