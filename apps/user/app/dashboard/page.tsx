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
import {
  Bot,
  LogOut,
  MessageSquare,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
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
              Dashboard
            </h1>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="outline">
              <LogOut className="size-4" />
              Log out
            </Button>
          </form>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-8 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Welcome back, {user.name}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/agents">
                <Bot className="size-4" />
                Agents
              </ButtonLink>
              <ButtonLink href="/agents/new" variant="outline">
                New agent
              </ButtonLink>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {agents.slice(0, 4).map((agent) => (
                <div
                  className="h-full rounded-md border border-zinc-200 p-4"
                  key={agent.id}
                >
                  <Link href={`/agents/${agent.id}`}>
                    <Bot className="mb-3 size-5 text-zinc-700" />
                    <p className="font-medium text-zinc-950">{agent.name}</p>
                    <p className="mt-1 text-sm text-zinc-500">{agent.model}</p>
                  </Link>
                  <div className="mt-4 flex flex-wrap gap-2">
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
                </div>
              ))}
              <Link href="/agents">
                <div className="rounded-md border border-zinc-200 p-4 transition-colors hover:border-zinc-300">
                <MessageSquare className="mb-3 size-5 text-zinc-700" />
                <p className="font-medium text-zinc-950">Conversations</p>
                <p className="mt-1 text-sm text-zinc-500">
                  Open an agent to view channel conversations.
                </p>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session</CardTitle>
            <CardDescription>Current authenticated user.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <UserRound className="size-5 text-zinc-600" />
              <div>
                <p className="text-sm font-medium text-zinc-950">{user.name}</p>
                <p className="text-sm text-zinc-500">{user.id}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-5 text-zinc-600" />
              <p className="text-sm text-zinc-600">
                Redis session active as {user.role}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
