import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listAgents } from "@/lib/api";
import { getCurrentUser, getSessionId } from "@/lib/session";
import { Bot, LogOut, MessageSquare, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AgentsPage() {
  const user = await getCurrentUser();
  const sessionId = await getSessionId();

  if (!user || !sessionId) {
    redirect("/login");
  }

  const agents = await listAgents(sessionId);

  return (
    <main className="min-h-svh bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm text-zinc-500">AI Agent Platform</p>
            <h1 className="text-xl font-semibold tracking-normal text-zinc-950">
              Agents
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <ButtonLink href="/agents/new">
              <Plus className="size-4" />
              New
            </ButtonLink>
            <form action={logoutAction}>
              <Button type="submit" variant="outline">
                <LogOut className="size-4" />
                Log out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        {agents.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {agents.map((agent) => (
              <Card className="h-full" key={agent.id}>
                <CardHeader>
                  <Link href={`/agents/${agent.id}`}>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Bot className="size-5 text-zinc-700" />
                      {agent.name}
                    </CardTitle>
                  </Link>
                  <CardDescription>{agent.model}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="line-clamp-3 text-sm text-zinc-600">
                    {agent.instructions}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs text-zinc-600">
                    <span className="rounded-md border border-zinc-200 px-2 py-1">
                      Key ****{agent.openaiApiKeyLastFour}
                    </span>
                    {agent.guardrailEnabled ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1">
                        <ShieldCheck className="size-3" />
                        Guardrail
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ButtonLink
                      href={`/agents/${agent.id}`}
                      size="sm"
                      variant="outline"
                    >
                      <Bot className="size-4" />
                      Configure
                    </ButtonLink>
                    <ButtonLink
                      href={`/agents/${agent.id}?tab=conversations`}
                      size="sm"
                    >
                      <MessageSquare className="size-4" />
                      Conversations
                    </ButtonLink>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No agents</CardTitle>
              <CardDescription>{user.email}</CardDescription>
            </CardHeader>
            <CardContent>
              <ButtonLink href="/agents/new">
                <Plus className="size-4" />
                New agent
              </ButtonLink>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
