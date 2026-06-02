import { AgentDetailTabs } from "@/components/agents/agent-detail-tabs";
import { ButtonLink } from "@/components/ui/button-link";
import { getAgentDetails } from "@/lib/api";
import { getCurrentUser, getSessionId } from "@/lib/session";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const user = await getCurrentUser();
  const sessionId = await getSessionId();

  if (!user || !sessionId) {
    redirect("/login");
  }

  const { agentId } = await params;
  const details = await getAgentDetails(sessionId, agentId).catch((error) => {
    if (
      error &&
      typeof error === "object" &&
      "statusCode" in error &&
      error.statusCode === 404
    ) {
      notFound();
    }

    throw error;
  });

  return (
    <main className="min-h-svh overflow-x-hidden bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0">
            <p className="text-sm text-zinc-500">AI Agent Platform</p>
            <h1 className="truncate text-xl font-semibold tracking-normal text-zinc-950">
              {details.agent.name}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {details.agent.model} · {details.agent.status}
            </p>
          </div>
          <ButtonLink className="shrink-0" href="/agents" variant="outline">
            <ArrowLeft className="size-4" />
            Agents
          </ButtonLink>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl min-w-0 px-6 py-8">
        <AgentDetailTabs details={details} />
      </div>
    </main>
  );
}
