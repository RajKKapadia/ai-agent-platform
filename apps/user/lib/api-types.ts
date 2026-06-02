export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  createdAt: string;
  updatedAt: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  name: string;
}

export interface AuthResponse {
  sessionId: string;
  expiresAt: string;
  user: ApiUser;
}

export interface ApiAgent {
  id: string;
  userId: string;
  name: string;
  instructions: string;
  model: string;
  status: "active" | "disabled";
  openaiApiKeyLastFour: string;
  openaiVectorStoreId: string | null;
  guardrailEnabled: boolean;
  guardrailPrompt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKnowledgeFile {
  id: string;
  agentId: string;
  openaiFileId: string;
  openaiVectorStoreFileId: string;
  filename: string;
  mimeType: string | null;
  bytes: number;
  status: "in_progress" | "completed" | "cancelled" | "failed";
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiAgentTool {
  id: string;
  agentId: string;
  name: string;
  description: string | null;
  enabled: boolean;
  config: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiMcpServer {
  id: string;
  agentId: string;
  name: string;
  serverUrl: string | null;
  command: string | null;
  transport: "hosted" | "streamable_http" | "stdio";
  requireApproval: "never" | "always";
  enabled: boolean;
  toolFilter: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentDetails {
  agent: ApiAgent;
  knowledgeFiles: ApiKnowledgeFile[];
  tools: ApiAgentTool[];
  mcpServers: ApiMcpServer[];
}

export interface CreateAgentInput {
  name: string;
  apiKey: string;
  model: string;
  instructions: string;
  guardrailEnabled: boolean;
  guardrailPrompt?: string;
}

export interface CreateToolInput {
  name: string;
  description?: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface CreateMcpServerInput {
  name: string;
  serverUrl?: string;
  command?: string;
  transport: "hosted" | "streamable_http" | "stdio";
  requireApproval: "never" | "always";
  enabled: boolean;
  toolFilter: Record<string, unknown>;
}
