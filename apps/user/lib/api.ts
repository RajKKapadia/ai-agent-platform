import "server-only";

import type {
  AgentDetails,
  ApiAgentConnection,
  ApiAgent,
  ApiConversationDetails,
  ApiConversationSummary,
  ApiAgentTool,
  ApiKnowledgeFile,
  ApiMcpServer,
  ApiUser,
  AuthResponse,
  CreateAgentInput,
  CreateMcpServerInput,
  CreateWhatsAppConnectionInput,
  CreateToolInput,
  LoginInput,
  RegisterInput,
  TestToolInput,
  ToolTestResult,
  UpdateAgentConfigurationInput,
  UpdateToolInput,
  UpdateWhatsAppConnectionInput,
} from "@/lib/api-types";
import { getRuntimeApiConfig } from "@repo/config/runtime";

export type {
  AgentDetails,
  ApiAgentConnection,
  ApiAgent,
  ApiConversationDetails,
  ApiConversationSummary,
  ApiAgentTool,
  ApiKnowledgeFile,
  ApiMcpServer,
  ApiUser,
  AuthResponse,
  CreateAgentInput,
  CreateMcpServerInput,
  CreateWhatsAppConnectionInput,
  CreateToolInput,
  LoginInput,
  RegisterInput,
  TestToolInput,
  ToolTestResult,
  UpdateAgentConfigurationInput,
  UpdateToolInput,
  UpdateWhatsAppConnectionInput,
} from "@/lib/api-types";

interface UserResponse {
  user: ApiUser;
}

interface AgentsResponse {
  agents: ApiAgent[];
}

interface AgentResponse {
  agent: ApiAgent;
}

interface ModelsResponse {
  models: string[];
}

interface GuardrailResponse {
  guardrailPrompt: string;
}

interface KnowledgeFileResponse {
  knowledgeFile: ApiKnowledgeFile;
}

interface ToolResponse {
  tool: ApiAgentTool;
}

interface ToolTestResponse {
  result: ToolTestResult;
}

interface McpServerResponse {
  mcpServer: ApiMcpServer;
}

interface ConnectionResponse {
  connection: ApiAgentConnection;
}

interface AgentConversationsResponse {
  conversations: ApiConversationSummary[];
}

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function requestApi<TResponse>(
  path: string,
  init: RequestInit,
): Promise<TResponse> {
  const apiConfig = getRuntimeApiConfig();
  const headers = new Headers(init.headers);

  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiConfig.url}${path}`, {
    ...init,
    cache: "no-store",
    headers,
  });

  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | TResponse
    | null;

  if (!response.ok) {
    const message =
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : "The API request failed";

    throw new ApiError(response.status, message);
  }

  return body as TResponse;
}

export async function registerUser(input: RegisterInput): Promise<ApiUser> {
  const response = await requestApi<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return response.user;
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  return requestApi<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  return requestApi<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getCurrentUser(sessionId: string): Promise<ApiUser> {
  const response = await requestApi<UserResponse>("/auth/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${sessionId}`,
    },
  });

  return response.user;
}

export async function logout(sessionId: string): Promise<void> {
  await requestApi<{ ok: true }>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

function authHeaders(sessionId: string): HeadersInit {
  return {
    Authorization: `Bearer ${sessionId}`,
  };
}

export async function validateOpenAIKey(
  sessionId: string,
  apiKey: string,
): Promise<string[]> {
  const response = await requestApi<ModelsResponse>("/agents/validate-key", {
    method: "POST",
    headers: authHeaders(sessionId),
    body: JSON.stringify({ apiKey }),
  });

  return response.models;
}

export async function generateAgentGuardrail(input: {
  sessionId: string;
  apiKey: string;
  model: string;
  agentPrompt: string;
}): Promise<string> {
  const response = await requestApi<GuardrailResponse>(
    "/agents/generate-guardrail",
    {
      method: "POST",
      headers: authHeaders(input.sessionId),
      body: JSON.stringify({
        apiKey: input.apiKey,
        model: input.model,
        agentPrompt: input.agentPrompt,
      }),
    },
  );

  return response.guardrailPrompt;
}

export async function generateStoredAgentGuardrail(input: {
  sessionId: string;
  agentId: string;
  model: string;
  agentPrompt: string;
}): Promise<string> {
  const response = await requestApi<GuardrailResponse>(
    `/agents/${input.agentId}/generate-guardrail`,
    {
      method: "POST",
      headers: authHeaders(input.sessionId),
      body: JSON.stringify({
        model: input.model,
        agentPrompt: input.agentPrompt,
      }),
    },
  );

  return response.guardrailPrompt;
}

export async function listAgents(sessionId: string): Promise<ApiAgent[]> {
  const response = await requestApi<AgentsResponse>("/agents", {
    method: "GET",
    headers: authHeaders(sessionId),
  });

  return response.agents;
}

export async function createAgent(
  sessionId: string,
  input: CreateAgentInput,
): Promise<ApiAgent> {
  const response = await requestApi<AgentResponse>("/agents", {
    method: "POST",
    headers: authHeaders(sessionId),
    body: JSON.stringify(input),
  });

  return response.agent;
}

export async function updateAgentConfiguration(
  sessionId: string,
  agentId: string,
  input: UpdateAgentConfigurationInput,
): Promise<ApiAgent> {
  const response = await requestApi<AgentResponse>(`/agents/${agentId}`, {
    method: "PATCH",
    headers: authHeaders(sessionId),
    body: JSON.stringify(input),
  });

  return response.agent;
}

export async function deleteAgent(
  sessionId: string,
  agentId: string,
): Promise<void> {
  await requestApi<{ ok: true }>(`/agents/${agentId}`, {
    method: "DELETE",
    headers: authHeaders(sessionId),
  });
}

export async function getAgentDetails(
  sessionId: string,
  agentId: string,
): Promise<AgentDetails> {
  return requestApi<AgentDetails>(`/agents/${agentId}`, {
    method: "GET",
    headers: authHeaders(sessionId),
  });
}

export async function listAgentConversations(
  sessionId: string,
  agentId: string,
  input: {
    channel?: string;
    connectionId?: string;
    cursor?: string;
    limit?: number;
  } = {},
): Promise<ApiConversationSummary[]> {
  const params = new URLSearchParams();

  if (input.channel) {
    params.set("channel", input.channel);
  }

  if (input.connectionId) {
    params.set("connectionId", input.connectionId);
  }

  if (input.cursor) {
    params.set("cursor", input.cursor);
  }

  if (input.limit) {
    params.set("limit", String(input.limit));
  }

  const query = params.toString();
  const response = await requestApi<AgentConversationsResponse>(
    `/agents/${agentId}/conversations${query ? `?${query}` : ""}`,
    {
      method: "GET",
      headers: authHeaders(sessionId),
    },
  );

  return response.conversations;
}

export async function getAgentConversationDetails(
  sessionId: string,
  agentId: string,
  conversationId: string,
): Promise<ApiConversationDetails> {
  return requestApi<ApiConversationDetails>(
    `/agents/${agentId}/conversations/${conversationId}`,
    {
      method: "GET",
      headers: authHeaders(sessionId),
    },
  );
}

export async function uploadAgentKnowledgeFile(
  sessionId: string,
  agentId: string,
  formData: FormData,
): Promise<ApiKnowledgeFile> {
  const response = await requestApi<KnowledgeFileResponse>(
    `/agents/${agentId}/knowledge`,
    {
      method: "POST",
      headers: authHeaders(sessionId),
      body: formData,
    },
  );

  return response.knowledgeFile;
}

export async function deleteAgentKnowledgeFile(
  sessionId: string,
  agentId: string,
  fileId: string,
): Promise<void> {
  await requestApi<{ ok: true }>(`/agents/${agentId}/knowledge/${fileId}`, {
    method: "DELETE",
    headers: authHeaders(sessionId),
  });
}

export async function createWhatsAppConnection(
  sessionId: string,
  agentId: string,
  input: CreateWhatsAppConnectionInput,
): Promise<ApiAgentConnection> {
  const response = await requestApi<ConnectionResponse>(
    `/agents/${agentId}/connections/whatsapp`,
    {
      method: "POST",
      headers: authHeaders(sessionId),
      body: JSON.stringify(input),
    },
  );

  return response.connection;
}

export async function deleteAgentConnection(
  sessionId: string,
  agentId: string,
  connectionId: string,
): Promise<void> {
  await requestApi<{ ok: true }>(
    `/agents/${agentId}/connections/${connectionId}`,
    {
      method: "DELETE",
      headers: authHeaders(sessionId),
    },
  );
}

export async function updateWhatsAppConnection(
  sessionId: string,
  agentId: string,
  connectionId: string,
  input: UpdateWhatsAppConnectionInput,
): Promise<ApiAgentConnection> {
  const response = await requestApi<ConnectionResponse>(
    `/agents/${agentId}/connections/${connectionId}`,
    {
      method: "PATCH",
      headers: authHeaders(sessionId),
      body: JSON.stringify(input),
    },
  );

  return response.connection;
}

export async function createAgentTool(
  sessionId: string,
  agentId: string,
  input: CreateToolInput,
): Promise<ApiAgentTool> {
  const response = await requestApi<ToolResponse>(`/agents/${agentId}/tools`, {
    method: "POST",
    headers: authHeaders(sessionId),
    body: JSON.stringify(input),
  });

  return response.tool;
}

export async function updateAgentTool(
  sessionId: string,
  agentId: string,
  toolId: string,
  input: UpdateToolInput,
): Promise<ApiAgentTool> {
  const response = await requestApi<ToolResponse>(
    `/agents/${agentId}/tools/${toolId}`,
    {
      method: "PATCH",
      headers: authHeaders(sessionId),
      body: JSON.stringify(input),
    },
  );

  return response.tool;
}

export async function testAgentTool(
  sessionId: string,
  agentId: string,
  input: TestToolInput,
): Promise<ToolTestResult> {
  const response = await requestApi<ToolTestResponse>(
    `/agents/${agentId}/tools/test`,
    {
      method: "POST",
      headers: authHeaders(sessionId),
      body: JSON.stringify(input),
    },
  );

  return response.result;
}

export async function deleteAgentTool(
  sessionId: string,
  agentId: string,
  toolId: string,
): Promise<void> {
  await requestApi<{ ok: true }>(`/agents/${agentId}/tools/${toolId}`, {
    method: "DELETE",
    headers: authHeaders(sessionId),
  });
}

export async function createAgentMcpServer(
  sessionId: string,
  agentId: string,
  input: CreateMcpServerInput,
): Promise<ApiMcpServer> {
  const response = await requestApi<McpServerResponse>(
    `/agents/${agentId}/mcp-servers`,
    {
      method: "POST",
      headers: authHeaders(sessionId),
      body: JSON.stringify(input),
    },
  );

  return response.mcpServer;
}

export async function deleteAgentMcpServer(
  sessionId: string,
  agentId: string,
  serverId: string,
): Promise<void> {
  await requestApi<{ ok: true }>(`/agents/${agentId}/mcp-servers/${serverId}`, {
    method: "DELETE",
    headers: authHeaders(sessionId),
  });
}
