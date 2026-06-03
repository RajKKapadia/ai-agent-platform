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

export type ToolParameterType =
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "array";

export interface ApiToolParameter {
  name: string;
  type: ToolParameterType;
  description: string;
  required: boolean;
}

export interface ApiToolHeader {
  name: string;
  value?: string;
  valuePreview?: string;
}

export interface HttpApiToolConfig {
  type: "http_api";
  method: "GET" | "POST";
  url: string;
  parameters: ApiToolParameter[];
  headers: ApiToolHeader[];
}

export interface ApiAgentTool {
  id: string;
  agentId: string;
  name: string;
  description: string | null;
  enabled: boolean;
  config: HttpApiToolConfig | Record<string, unknown> | null;
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

export interface ApiAgentConnection {
  id: string;
  agentId: string;
  userId: string;
  channel: "whatsapp";
  name: string;
  status: "pending" | "active" | "disabled";
  externalId: string;
  appId: string;
  accessTokenLastFour: string;
  verificationToken: string;
  webhookUrl: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiConversationMessage {
  id: string;
  conversationId: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ApiConversationSummary {
  id: string;
  agentId: string;
  userId: string;
  title: string | null;
  channel: string | null;
  connectionId: string | null;
  connectionName: string | null;
  externalContactId: string | null;
  displayName: string | null;
  lastMessage: ApiConversationMessage | null;
  lastMessageAt: string;
  messageCount: number;
  metadata: Record<string, unknown> | null;
  channelMetadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiConversationDetails {
  conversation: ApiConversationSummary;
  messages: ApiConversationMessage[];
}

export interface AgentDetails {
  agent: ApiAgent;
  knowledgeFiles: ApiKnowledgeFile[];
  tools: ApiAgentTool[];
  mcpServers: ApiMcpServer[];
  connections: ApiAgentConnection[];
}

export interface CreateAgentInput {
  name: string;
  apiKey: string;
  model: string;
  instructions: string;
  guardrailEnabled: boolean;
  guardrailPrompt?: string;
}

export interface UpdateAgentConfigurationInput {
  name: string;
  model: string;
  instructions: string;
  status: "active" | "disabled";
  guardrailEnabled: boolean;
  guardrailPrompt?: string;
}

export interface CreateToolInput {
  name: string;
  description?: string;
  enabled: boolean;
  config: HttpApiToolConfig;
}

export type UpdateToolInput = CreateToolInput;

export interface TestToolInput {
  toolId?: string;
  config: HttpApiToolConfig;
  parameters: Record<string, unknown>;
}

export interface ToolTestResult {
  ok: boolean;
  status: number;
  bodyPreview: string;
  headersPreview: Record<string, string>;
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

export interface CreateWhatsAppConnectionInput {
  name: string;
  phoneNumberId: string;
  accessToken: string;
  appId: string;
  appSecret: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateWhatsAppConnectionInput {
  name: string;
  phoneNumberId: string;
  appId: string;
  accessToken?: string;
  appSecret?: string;
  metadata?: Record<string, unknown>;
}
