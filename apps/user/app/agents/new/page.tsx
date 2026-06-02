import { NewAgentForm } from "@/components/agents/new-agent-form";
import { ButtonLink } from "@/components/ui/button-link";
import { getCurrentUser } from "@/lib/session";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";

export default async function NewAgentPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-svh bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm text-zinc-500">AI Agent Platform</p>
            <h1 className="text-xl font-semibold tracking-normal text-zinc-950">
              New agent
            </h1>
          </div>
          <ButtonLink href="/agents" variant="outline">
            <ArrowLeft className="size-4" />
            Agents
          </ButtonLink>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <NewAgentForm />
      </div>
    </main>
  );
}
