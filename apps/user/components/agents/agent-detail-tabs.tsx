"use client";

import {
  deleteKnowledgeFileAction,
  deleteMcpServerAction,
  deleteToolAction,
} from "@/app/actions/agents";
import {
  KnowledgeUploadForm,
  McpServerCreateForm,
  ToolCreateForm,
} from "@/components/agents/agent-resource-forms";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AgentDetails } from "@/lib/api-types";
import {
  Bot,
  Database,
  FileText,
  Plug,
  ShieldCheck,
  Trash2,
  Wrench,
} from "lucide-react";
import { useState } from "react";

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AgentDetailTabs({ details }: { details: AgentDetails }) {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <Tabs onValueChange={setActiveTab} value={activeTab}>
      <TabsList>
        <TabsTrigger value="overview">
          <Bot className="size-4 shrink-0" />
          <span className="min-w-0 truncate">Overview</span>
        </TabsTrigger>
        <TabsTrigger value="knowledge">
          <Database className="size-4 shrink-0" />
          <span className="min-w-0 truncate">Knowledge</span>
          <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 group-aria-selected:bg-white">
            {details.knowledgeFiles.length}
          </span>
        </TabsTrigger>
        <TabsTrigger value="tools">
          <Wrench className="size-4 shrink-0" />
          <span className="min-w-0 truncate">Tools</span>
          <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 group-aria-selected:bg-white">
            {details.tools.length}
          </span>
        </TabsTrigger>
        <TabsTrigger value="mcp">
          <Plug className="size-4 shrink-0" />
          <span className="min-w-0 truncate">MCP</span>
          <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 group-aria-selected:bg-white">
            {details.mcpServers.length}
          </span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bot className="size-5 text-zinc-700" />
              Overview
            </CardTitle>
            <CardDescription>{details.agent.model}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
              <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                {details.agent.instructions}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-zinc-200 p-3">
                <p className="text-xs uppercase text-zinc-500">Status</p>
                <p className="mt-1 text-sm font-medium text-zinc-950">
                  {details.agent.status}
                </p>
              </div>
              <div className="rounded-md border border-zinc-200 p-3">
                <p className="text-xs uppercase text-zinc-500">Key</p>
                <p className="mt-1 text-sm font-medium text-zinc-950">
                  ****{details.agent.openaiApiKeyLastFour}
                </p>
              </div>
              <div className="rounded-md border border-zinc-200 p-3">
                <p className="text-xs uppercase text-zinc-500">Vector store</p>
                <p className="mt-1 truncate text-sm font-medium text-zinc-950">
                  {details.agent.openaiVectorStoreId ?? "Not created"}
                </p>
              </div>
            </div>
            {details.agent.guardrailEnabled ? (
              <div className="rounded-md border border-zinc-200 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <ShieldCheck className="size-4 text-zinc-700" />
                  <p className="text-sm font-medium text-zinc-950">Guardrail</p>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-600">
                  {details.agent.guardrailPrompt}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="knowledge">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="size-5 text-zinc-700" />
              Knowledge base
            </CardTitle>
            <CardDescription>
              {details.knowledgeFiles.length} files in the agent vector store
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <KnowledgeUploadForm agentId={details.agent.id} />
            <div className="divide-y divide-zinc-200 rounded-md border border-zinc-200">
              {details.knowledgeFiles.length > 0 ? (
                details.knowledgeFiles.map((file) => (
                  <div
                    className="flex items-center justify-between gap-4 p-3"
                    key={file.id}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText className="size-5 shrink-0 text-zinc-600" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-950">
                          {file.filename}
                        </p>
                        <p className="text-sm text-zinc-500">
                          {formatBytes(file.bytes)} · {file.status}
                        </p>
                      </div>
                    </div>
                    <form
                      action={deleteKnowledgeFileAction.bind(
                        null,
                        details.agent.id,
                        file.id,
                      )}
                    >
                      <Button size="sm" type="submit" variant="outline">
                        <Trash2 className="size-4" />
                      </Button>
                    </form>
                  </div>
                ))
              ) : (
                <p className="p-3 text-sm text-zinc-500">No files</p>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="tools">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wrench className="size-5 text-zinc-700" />
              Tools
            </CardTitle>
            <CardDescription>{details.tools.length} tools</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToolCreateForm agentId={details.agent.id} />
            <div className="divide-y divide-zinc-200 rounded-md border border-zinc-200">
              {details.tools.length > 0 ? (
                details.tools.map((tool) => (
                  <div
                    className="flex items-center justify-between gap-4 p-3"
                    key={tool.id}
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-950">
                        {tool.name}
                      </p>
                      <p className="text-sm text-zinc-500">
                        {tool.enabled ? "enabled" : "disabled"}
                      </p>
                    </div>
                    <form
                      action={deleteToolAction.bind(
                        null,
                        details.agent.id,
                        tool.id,
                      )}
                    >
                      <Button size="sm" type="submit" variant="outline">
                        <Trash2 className="size-4" />
                      </Button>
                    </form>
                  </div>
                ))
              ) : (
                <p className="p-3 text-sm text-zinc-500">No tools</p>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="mcp">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plug className="size-5 text-zinc-700" />
              MCP
            </CardTitle>
            <CardDescription>
              {details.mcpServers.length} servers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <McpServerCreateForm agentId={details.agent.id} />
            <div className="divide-y divide-zinc-200 rounded-md border border-zinc-200">
              {details.mcpServers.length > 0 ? (
                details.mcpServers.map((server) => (
                  <div className="space-y-3 p-3" key={server.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-950">
                          {server.name}
                        </p>
                        <p className="text-sm text-zinc-500">
                          {server.transport}
                        </p>
                      </div>
                      <form
                        action={deleteMcpServerAction.bind(
                          null,
                          details.agent.id,
                          server.id,
                        )}
                      >
                        <Button size="sm" type="submit" variant="outline">
                          <Trash2 className="size-4" />
                        </Button>
                      </form>
                    </div>
                    {server.serverUrl ? (
                      <p className="break-all text-xs text-zinc-500">
                        {server.serverUrl}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="p-3 text-sm text-zinc-500">No MCP servers</p>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
