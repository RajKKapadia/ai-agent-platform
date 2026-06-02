"use client";

import {
  deleteAgentAction,
  deleteConnectionAction,
  deleteKnowledgeFileAction,
  deleteMcpServerAction,
  deleteToolAction,
  generateStoredAgentGuardrailAction,
  updateAgentConfigurationAction,
} from "@/app/actions/agents";
import { Alert } from "@/components/ui/alert";
import {
  CopyValue,
  KnowledgeUploadForm,
  McpServerCreateForm,
  ToolCreateForm,
  WhatsAppConnectionEditForm,
  WhatsAppConnectionCreateForm,
} from "@/components/agents/agent-resource-forms";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type {
  AgentDetails,
  ApiAgent,
  ApiConversationDetails,
  ApiConversationSummary,
} from "@/lib/api-types";
import {
  Bot,
  Clock,
  Database,
  FileText,
  Loader2,
  MessageCircle,
  MessagesSquare,
  Pencil,
  Plug,
  ShieldCheck,
  Save,
  Trash2,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function getConversationTitle(conversation: ApiConversationSummary) {
  return (
    conversation.displayName ??
    conversation.title ??
    conversation.externalContactId ??
    "Conversation"
  );
}

function getRoleClassName(role: string) {
  if (role === "assistant") {
    return "border-zinc-900 bg-zinc-950 text-white";
  }

  if (role === "user") {
    return "border-zinc-200 bg-white text-zinc-950";
  }

  return "border-zinc-200 bg-zinc-100 text-zinc-700";
}

function AgentOverviewEditForm({
  agent,
  onCancel,
  onSaved,
}: {
  agent: ApiAgent;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(agent.name);
  const [model, setModel] = useState(agent.model);
  const [instructions, setInstructions] = useState(agent.instructions);
  const [status, setStatus] = useState<ApiAgent["status"]>(agent.status);
  const [guardrailEnabled, setGuardrailEnabled] = useState(
    agent.guardrailEnabled,
  );
  const [guardrailPrompt, setGuardrailPrompt] = useState(
    agent.guardrailPrompt ?? "",
  );
  const [error, setError] = useState<string>();
  const [isGenerating, startGeneration] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const canGenerate =
    guardrailEnabled &&
    model.trim().length > 0 &&
    instructions.trim().length >= 10 &&
    !isGenerating;
  const canSave =
    name.trim().length >= 2 &&
    model.trim().length > 0 &&
    instructions.trim().length >= 10 &&
    !isSaving;

  function saveConfiguration() {
    setError(undefined);
    startSaving(async () => {
      const result = await updateAgentConfigurationAction(agent.id, {
        name,
        model,
        instructions,
        status,
        guardrailEnabled,
        guardrailPrompt,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      const fieldErrors = result.fieldErrors;

      if (fieldErrors) {
        setError(
          Object.values(fieldErrors)
            .flat()
            .filter(Boolean)
            .join(", ") || "Check the configuration values",
        );
        return;
      }

      onSaved();
    });
  }

  function generateGuardrail() {
    setError(undefined);
    startGeneration(async () => {
      const result = await generateStoredAgentGuardrailAction(agent.id, {
        model,
        agentPrompt: instructions,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      const fieldErrors = result.fieldErrors;

      if (fieldErrors) {
        setError(
          Object.values(fieldErrors)
            .flat()
            .filter(Boolean)
            .join(", ") || "Check the model and prompt values",
        );
        return;
      }

      setGuardrailPrompt(result.data?.guardrailPrompt ?? "");
    });
  }

  return (
    <div className="space-y-5">
      {error ? <Alert>{error}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="agentName">Name</Label>
          <Input
            id="agentName"
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="agentModel">Model</Label>
          <Input
            id="agentModel"
            onChange={(event) => setModel(event.target.value)}
            value={model}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="agentStatus">Status</Label>
          <Select
            id="agentStatus"
            onChange={(event) =>
              setStatus(event.target.value as ApiAgent["status"])
            }
            value={status}
          >
            <option value="active">active</option>
            <option value="disabled">disabled</option>
          </Select>
        </div>
        <div className="rounded-md border border-zinc-200 p-3">
          <p className="text-xs uppercase text-zinc-500">Key</p>
          <p className="mt-1 text-sm font-medium text-zinc-950">
            ****{agent.openaiApiKeyLastFour}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="agentInstructions">Prompt</Label>
        <Textarea
          id="agentInstructions"
          onChange={(event) => setInstructions(event.target.value)}
          rows={8}
          value={instructions}
        />
      </div>

      <div className="space-y-3 rounded-md border border-zinc-200 p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-zinc-950">
          <input
            checked={guardrailEnabled}
            className="size-4 rounded border-zinc-300"
            onChange={(event) => setGuardrailEnabled(event.target.checked)}
            type="checkbox"
          />
          Guardrail
        </label>
        <Textarea
          disabled={!guardrailEnabled}
          onChange={(event) => setGuardrailPrompt(event.target.value)}
          rows={6}
          value={guardrailPrompt}
        />
        <Button
          disabled={!canGenerate}
          onClick={generateGuardrail}
          type="button"
          variant="outline"
        >
          {isGenerating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ShieldCheck className="size-4" />
          )}
          Generate
        </Button>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button disabled={isSaving} onClick={onCancel} type="button" variant="outline">
          <X className="size-4" />
          Cancel
        </Button>
        <Button disabled={!canSave} onClick={saveConfiguration} type="button">
          {isSaving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save
        </Button>
      </div>
    </div>
  );
}

export function AgentDetailTabs({
  activeChannel,
  activeConnectionId,
  activeTab,
  conversations,
  details,
  selectedConversation,
}: {
  activeChannel?: string;
  activeConnectionId?: string;
  activeTab: string;
  conversations: ApiConversationSummary[];
  details: AgentDetails;
  selectedConversation: ApiConversationDetails | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingConnectionId, setEditingConnectionId] = useState<
    string | null
  >(null);
  const [isEditingConfiguration, setIsEditingConfiguration] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();
  const [filePendingDelete, setFilePendingDelete] = useState<
    AgentDetails["knowledgeFiles"][number] | null
  >(null);
  const [knowledgeDeleteError, setKnowledgeDeleteError] = useState<string>();
  const [isDeleting, startDeleting] = useTransition();
  const [isDeletingKnowledgeFile, startDeletingKnowledgeFile] =
    useTransition();
  const whatsAppConnection = details.connections.find(
    (connection) => connection.channel === "whatsapp",
  );
  const selectedConversationId = selectedConversation?.conversation.id;
  const availableChannels = Array.from(
    new Set(
      conversations
        .map((conversation) => conversation.channel)
        .filter((channel): channel is string => Boolean(channel)),
    ),
  );

  function buildHref(input: {
    tab?: string;
    conversationId?: string | null;
    channel?: string | null;
    connectionId?: string | null;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    const tab = input.tab ?? activeTab;

    if (tab === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }

    if (input.conversationId === null) {
      params.delete("conversationId");
    } else if (input.conversationId) {
      params.set("conversationId", input.conversationId);
    }

    if (input.channel === null) {
      params.delete("channel");
    } else if (input.channel) {
      params.set("channel", input.channel);
    }

    if (input.connectionId === null) {
      params.delete("connectionId");
    } else if (input.connectionId) {
      params.set("connectionId", input.connectionId);
    }

    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  function handleTabChange(value: string) {
    router.push(
      buildHref({
        tab: value,
        conversationId: value === "conversations" ? undefined : null,
        channel: value === "conversations" ? undefined : null,
        connectionId: value === "conversations" ? undefined : null,
      }),
    );
  }

  function deleteCurrentAgent() {
    setDeleteError(undefined);
    startDeleting(async () => {
      const result = await deleteAgentAction(details.agent.id);

      if (result.error) {
        setDeleteError(result.error);
        return;
      }

      router.push("/agents");
    });
  }

  function openKnowledgeDeleteDialog(
    file: AgentDetails["knowledgeFiles"][number],
  ) {
    setKnowledgeDeleteError(undefined);
    setFilePendingDelete(file);
  }

  function closeKnowledgeDeleteDialog() {
    if (isDeletingKnowledgeFile) {
      return;
    }

    setFilePendingDelete(null);
    setKnowledgeDeleteError(undefined);
  }

  function deleteSelectedKnowledgeFile() {
    if (!filePendingDelete) {
      return;
    }

    setKnowledgeDeleteError(undefined);
    startDeletingKnowledgeFile(async () => {
      const result = await deleteKnowledgeFileAction(
        details.agent.id,
        filePendingDelete.id,
      );

      if (result.error) {
        setKnowledgeDeleteError(result.error);
        return;
      }

      setFilePendingDelete(null);
      router.refresh();
    });
  }

  useEffect(() => {
    if (activeTab !== "conversations") {
      return;
    }

    const source = new EventSource(
      `/api/agents/${details.agent.id}/conversation-events`,
    );
    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = setTimeout(() => {
        router.refresh();
      }, 300);
    };
    const handleConversation = (event: Event) => {
      try {
        const data = JSON.parse((event as MessageEvent<string>).data) as {
          agentId?: string;
        };

        if (data.agentId === details.agent.id) {
          scheduleRefresh();
        }
      } catch {
        scheduleRefresh();
      }
    };

    source.addEventListener("conversation", handleConversation);

    return () => {
      source.removeEventListener("conversation", handleConversation);
      source.close();

      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, [activeTab, details.agent.id, router]);

  return (
    <Tabs onValueChange={handleTabChange} value={activeTab}>
      <TabsList className="sm:grid-cols-3 lg:grid-cols-6">
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
        <TabsTrigger value="connections">
          <MessageCircle className="size-4 shrink-0" />
          <span className="min-w-0 truncate">Connections</span>
          <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 group-aria-selected:bg-white">
            {details.connections.length}
          </span>
        </TabsTrigger>
        <TabsTrigger value="conversations">
          <MessagesSquare className="size-4 shrink-0" />
          <span className="min-w-0 truncate">Conversations</span>
          <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 group-aria-selected:bg-white">
            {conversations.length}
          </span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bot className="size-5 text-zinc-700" />
                Overview
              </CardTitle>
              <CardDescription>{details.agent.model}</CardDescription>
            </div>
            {!isEditingConfiguration ? (
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  onClick={() => setIsEditingConfiguration(true)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Pencil className="size-4" />
                  Edit
                </Button>
                <Button
                  onClick={() => {
                    setDeleteError(undefined);
                    setIsDeleteDialogOpen(true);
                  }}
                  size="sm"
                  type="button"
                  variant="destructive"
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-5">
            {isEditingConfiguration ? (
              <AgentOverviewEditForm
                agent={details.agent}
                onCancel={() => setIsEditingConfiguration(false)}
                onSaved={() => {
                  setIsEditingConfiguration(false);
                  router.refresh();
                }}
              />
            ) : (
              <>
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
                    <p className="text-xs uppercase text-zinc-500">
                      Vector store
                    </p>
                    <p className="mt-1 truncate text-sm font-medium text-zinc-950">
                      {details.agent.openaiVectorStoreId ?? "Not created"}
                    </p>
                  </div>
                </div>
                {details.agent.guardrailEnabled ? (
                  <div className="rounded-md border border-zinc-200 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <ShieldCheck className="size-4 text-zinc-700" />
                      <p className="text-sm font-medium text-zinc-950">
                        Guardrail
                      </p>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-600">
                      {details.agent.guardrailPrompt}
                    </p>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {isDeleteDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-5 shadow-lg">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-md bg-red-50 p-2 text-red-600">
                <Trash2 className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-zinc-950">
                  Delete {details.agent.name}
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  This will permanently delete the agent, knowledge records,
                  tools, MCP servers, channel connections, conversations,
                  messages, and AI memory. This cannot be undone.
                </p>
              </div>
            </div>
            {deleteError ? <Alert>{deleteError}</Alert> : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                disabled={isDeleting}
                onClick={() => setIsDeleteDialogOpen(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={isDeleting}
                onClick={deleteCurrentAgent}
                type="button"
                variant="destructive"
              >
                {isDeleting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Delete agent
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {filePendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-5 shadow-lg">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-md bg-red-50 p-2 text-red-600">
                <Trash2 className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-zinc-950">
                  Delete knowledge file
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  This will permanently remove the file from the knowledge
                  base, OpenAI vector store, and OpenAI file storage.
                </p>
                <p className="mt-3 truncate rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-950">
                  {filePendingDelete.filename}
                </p>
              </div>
            </div>
            {knowledgeDeleteError ? <Alert>{knowledgeDeleteError}</Alert> : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                disabled={isDeletingKnowledgeFile}
                onClick={closeKnowledgeDeleteDialog}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={isDeletingKnowledgeFile}
                onClick={deleteSelectedKnowledgeFile}
                type="button"
                variant="destructive"
              >
                {isDeletingKnowledgeFile ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Delete file
              </Button>
            </div>
          </div>
        </div>
      ) : null}

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
                    <Button
                      aria-label={`Delete ${file.filename}`}
                      onClick={() => openKnowledgeDeleteDialog(file)}
                      size="sm"
                      title={`Delete ${file.filename}`}
                      type="button"
                      variant="outline"
                    >
                      <Trash2 className="size-4" />
                    </Button>
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

      <TabsContent value="connections">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageCircle className="size-5 text-zinc-700" />
              Connections
            </CardTitle>
            <CardDescription>
              {details.connections.length} channel connections
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!whatsAppConnection ? (
              <WhatsAppConnectionCreateForm agentId={details.agent.id} />
            ) : null}
            <div className="divide-y divide-zinc-200 rounded-md border border-zinc-200">
              {details.connections.length > 0 ? (
                details.connections.map((connection) => (
                  <div className="space-y-3 p-3" key={connection.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-950">
                          {connection.name}
                        </p>
                        <p className="text-sm text-zinc-500">
                          {connection.channel} · {connection.status} · phone{" "}
                          {connection.externalId}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          onClick={() =>
                            setEditingConnectionId((currentId) =>
                              currentId === connection.id
                                ? null
                                : connection.id,
                            )
                          }
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <form
                          action={deleteConnectionAction.bind(
                            null,
                            details.agent.id,
                            connection.id,
                          )}
                        >
                          <Button size="sm" type="submit" variant="outline">
                            <Trash2 className="size-4" />
                          </Button>
                        </form>
                      </div>
                    </div>
                    {editingConnectionId === connection.id ? (
                      <WhatsAppConnectionEditForm
                        agentId={details.agent.id}
                        connection={connection}
                        onCancel={() => setEditingConnectionId(null)}
                      />
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <CopyValue
                          label="Webhook URL"
                          value={connection.webhookUrl}
                        />
                        <CopyValue
                          label="Verification token"
                          value={connection.verificationToken}
                        />
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="p-3 text-sm text-zinc-500">
                  No channel connections
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="conversations">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessagesSquare className="size-5 text-zinc-700" />
              Conversations
            </CardTitle>
            <CardDescription>
              {conversations.length} recent conversations for this agent
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                className={
                  !activeChannel && !activeConnectionId
                    ? "rounded-md bg-zinc-950 px-3 py-1.5 text-sm font-medium text-white"
                    : "rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                }
                href={buildHref({
                  tab: "conversations",
                  channel: null,
                  connectionId: null,
                  conversationId: null,
                })}
              >
                All channels
              </Link>
              {availableChannels.map((channel) => (
                <Link
                  className={
                    activeChannel === channel && !activeConnectionId
                      ? "rounded-md bg-zinc-950 px-3 py-1.5 text-sm font-medium text-white"
                      : "rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  }
                  href={buildHref({
                    tab: "conversations",
                    channel,
                    connectionId: null,
                    conversationId: null,
                  })}
                  key={channel}
                >
                  {channel}
                </Link>
              ))}
              {details.connections.map((connection) => (
                <Link
                  className={
                    activeConnectionId === connection.id
                      ? "rounded-md bg-zinc-950 px-3 py-1.5 text-sm font-medium text-white"
                      : "rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  }
                  href={buildHref({
                    tab: "conversations",
                    channel: connection.channel,
                    connectionId: connection.id,
                    conversationId: null,
                  })}
                  key={connection.id}
                >
                  {connection.name}
                </Link>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(260px,340px)_1fr]">
              <div className="min-h-[420px] overflow-hidden rounded-md border border-zinc-200 bg-white">
                <div className="border-b border-zinc-200 px-4 py-3">
                  <p className="text-sm font-medium text-zinc-950">
                    Conversation list
                  </p>
                  <p className="text-xs text-zinc-500">
                    Latest activity first
                  </p>
                </div>
                <div className="max-h-[560px] overflow-y-auto">
                  {conversations.length > 0 ? (
                    conversations.map((conversation) => {
                      const isSelected =
                        selectedConversationId === conversation.id;

                      return (
                        <Link
                          className={
                            isSelected
                              ? "block border-b border-zinc-200 bg-zinc-950 p-4 text-white"
                              : "block border-b border-zinc-200 p-4 transition-colors hover:bg-zinc-50"
                          }
                          href={buildHref({
                            tab: "conversations",
                            conversationId: conversation.id,
                          })}
                          key={conversation.id}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p
                                className={
                                  isSelected
                                    ? "truncate text-sm font-medium text-white"
                                    : "truncate text-sm font-medium text-zinc-950"
                                }
                              >
                                {getConversationTitle(conversation)}
                              </p>
                              <p
                                className={
                                  isSelected
                                    ? "mt-1 truncate text-xs text-zinc-300"
                                    : "mt-1 truncate text-xs text-zinc-500"
                                }
                              >
                                {conversation.channel ?? "channel"} ·{" "}
                                {conversation.connectionName ??
                                  "connection"}
                              </p>
                            </div>
                            <span
                              className={
                                isSelected
                                  ? "shrink-0 rounded bg-white px-1.5 py-0.5 text-xs text-zinc-950"
                                  : "shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600"
                              }
                            >
                              {conversation.messageCount}
                            </span>
                          </div>
                          <p
                            className={
                              isSelected
                                ? "mt-3 line-clamp-2 text-sm text-zinc-200"
                                : "mt-3 line-clamp-2 text-sm text-zinc-600"
                            }
                          >
                            {conversation.lastMessage?.content ??
                              "No messages yet"}
                          </p>
                          <p
                            className={
                              isSelected
                                ? "mt-3 flex items-center gap-1 text-xs text-zinc-300"
                                : "mt-3 flex items-center gap-1 text-xs text-zinc-500"
                            }
                          >
                            <Clock className="size-3" />
                            {formatDateTime(conversation.lastMessageAt)}
                          </p>
                        </Link>
                      );
                    })
                  ) : (
                    <p className="p-4 text-sm text-zinc-500">
                      No conversations match this view.
                    </p>
                  )}
                </div>
              </div>

              <div className="min-h-[420px] overflow-hidden rounded-md border border-zinc-200 bg-white">
                {selectedConversation ? (
                  <>
                    <div className="border-b border-zinc-200 px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-950">
                            {getConversationTitle(
                              selectedConversation.conversation,
                            )}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {selectedConversation.conversation.channel ??
                              "channel"}{" "}
                            ·{" "}
                            {selectedConversation.conversation.connectionName ??
                              "connection"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-zinc-600">
                          {selectedConversation.conversation
                            .externalContactId ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1">
                              <UserRound className="size-3" />
                              {
                                selectedConversation.conversation
                                  .externalContactId
                              }
                            </span>
                          ) : null}
                          <span className="rounded-md border border-zinc-200 px-2 py-1">
                            {selectedConversation.messages.length} messages
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="max-h-[560px] space-y-3 overflow-y-auto bg-zinc-50 p-4">
                      {selectedConversation.messages.length > 0 ? (
                        selectedConversation.messages.map((message) => (
                          <div
                            className={
                              message.role === "assistant"
                                ? "flex justify-start"
                                : "flex justify-end"
                            }
                            key={message.id}
                          >
                            <div
                              className={`max-w-[85%] rounded-md border px-3 py-2 ${getRoleClassName(
                                message.role,
                              )}`}
                            >
                              <div className="mb-1 flex items-center justify-between gap-3">
                                <span className="text-xs font-medium uppercase">
                                  {message.role}
                                </span>
                                <span className="text-xs opacity-70">
                                  {formatDateTime(message.createdAt)}
                                </span>
                              </div>
                              <p className="whitespace-pre-wrap text-sm leading-6">
                                {message.content}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-zinc-500">
                          No messages have been recorded for this conversation.
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-[420px] items-center justify-center p-6 text-center">
                    <div>
                      <MessagesSquare className="mx-auto mb-3 size-8 text-zinc-400" />
                      <p className="text-sm font-medium text-zinc-950">
                        No conversation selected
                      </p>
                      <p className="mt-1 text-sm text-zinc-500">
                        Conversations created by connected channels will appear
                        here.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
