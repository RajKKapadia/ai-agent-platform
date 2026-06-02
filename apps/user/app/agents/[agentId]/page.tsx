import { AgentDetailTabs } from "@/components/agents/agent-detail-tabs";
import { ButtonLink } from "@/components/ui/button-link";
import {
  getAgentConversationDetails,
  getAgentDetails,
  listAgentConversations,
} from "@/lib/api";
import type { ApiConversationDetails } from "@/lib/api-types";
import { getCurrentUser, getSessionId } from "@/lib/session";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";

const agentTabs = new Set([
  "overview",
  "knowledge",
  "tools",
  "mcp",
  "connections",
  "conversations",
]);

function getSearchValue(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];

  if (typeof value === "string") {
    return value;
  }

  return Array.isArray(value) ? value[0] : undefined;
}

export default async function AgentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ agentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  const sessionId = await getSessionId();

  if (!user || !sessionId) {
    redirect("/login");
  }

  const { agentId } = await params;
  const query = await searchParams;
  const requestedTab = getSearchValue(query, "tab");
  const activeTab =
    requestedTab && agentTabs.has(requestedTab) ? requestedTab : "overview";
  const channelParam = getSearchValue(query, "channel");
  const channel = channelParam === "whatsapp" ? channelParam : undefined;
  const connectionId = getSearchValue(query, "connectionId");
  const requestedConversationId = getSearchValue(query, "conversationId");
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
  const conversations = await listAgentConversations(sessionId, agentId, {
    channel,
    connectionId,
    limit: 25,
  });
  const selectedConversationId =
    conversations.find(
      (conversation) => conversation.id === requestedConversationId,
    )?.id ?? conversations[0]?.id;
  let selectedConversation: ApiConversationDetails | null = null;

  if (activeTab === "conversations" && selectedConversationId) {
    selectedConversation = await getAgentConversationDetails(
      sessionId,
      agentId,
      selectedConversationId,
    ).catch((error) => {
      if (
        error &&
        typeof error === "object" &&
        "statusCode" in error &&
        error.statusCode === 404
      ) {
        return null;
      }

      throw error;
    });
  }

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
        <AgentDetailTabs
          activeChannel={channel}
          activeConnectionId={connectionId}
          activeTab={activeTab}
          conversations={conversations}
          details={details}
          selectedConversation={selectedConversation}
        />
      </div>
    </main>
  );
}
