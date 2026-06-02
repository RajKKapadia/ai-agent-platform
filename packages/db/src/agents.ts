import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "./client";
import {
  agentKnowledgeFiles,
  agentMcpServers,
  agentTools,
  agents,
  type NewAgent,
  type NewAgentKnowledgeFile,
  type NewAgentMcpServer,
  type NewAgentTool,
} from "./schema";

export interface CreateAgentRecordInput {
  userId: string;
  name: string;
  instructions: string;
  model: string;
  openaiApiKeyCiphertext: string;
  openaiApiKeyIv: string;
  openaiApiKeyAuthTag: string;
  openaiApiKeyLastFour: string;
  openaiVectorStoreId?: string | null;
  guardrailEnabled?: boolean;
  guardrailPrompt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateKnowledgeFileInput {
  agentId: string;
  openaiFileId: string;
  openaiVectorStoreFileId: string;
  filename: string;
  mimeType?: string | null;
  bytes: number;
  status?: NewAgentKnowledgeFile["status"];
  metadata?: Record<string, unknown>;
}

export interface CreateToolInput {
  agentId: string;
  name: string;
  description?: string | null;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

export interface UpdateToolInput {
  name?: string;
  description?: string | null;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

export interface CreateMcpServerInput {
  agentId: string;
  name: string;
  serverUrl?: string | null;
  command?: string | null;
  transport?: NewAgentMcpServer["transport"];
  requireApproval?: NewAgentMcpServer["requireApproval"];
  enabled?: boolean;
  toolFilter?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UpdateMcpServerInput {
  name?: string;
  serverUrl?: string | null;
  command?: string | null;
  transport?: NewAgentMcpServer["transport"];
  requireApproval?: NewAgentMcpServer["requireApproval"];
  enabled?: boolean;
  toolFilter?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

function compactObject<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as T;
}

export async function createAgent(input: NewAgent) {
  const [agent] = await db.insert(agents).values(input).returning();

  if (!agent) {
    throw new Error("Failed to create agent");
  }

  return agent;
}

export async function createAgentRecord(input: CreateAgentRecordInput) {
  return createAgent({
    userId: input.userId,
    name: input.name,
    instructions: input.instructions,
    model: input.model,
    openaiApiKeyCiphertext: input.openaiApiKeyCiphertext,
    openaiApiKeyIv: input.openaiApiKeyIv,
    openaiApiKeyAuthTag: input.openaiApiKeyAuthTag,
    openaiApiKeyLastFour: input.openaiApiKeyLastFour,
    openaiVectorStoreId: input.openaiVectorStoreId,
    guardrailEnabled: input.guardrailEnabled ?? false,
    guardrailPrompt: input.guardrailPrompt,
    metadata: input.metadata ?? {},
  });
}

export async function listAgents() {
  return db.select().from(agents).orderBy(asc(agents.createdAt));
}

export async function listAgentsByUserId(userId: string) {
  return db
    .select()
    .from(agents)
    .where(eq(agents.userId, userId))
    .orderBy(desc(agents.createdAt));
}

export async function getAgentById(id: string) {
  const [agent] = await db.select().from(agents).where(eq(agents.id, id));
  return agent ?? null;
}

export async function getAgentByIdForUser(id: string, userId: string) {
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.userId, userId)));

  return agent ?? null;
}

export async function setAgentVectorStoreId(
  id: string,
  userId: string,
  openaiVectorStoreId: string,
) {
  const [agent] = await db
    .update(agents)
    .set({ openaiVectorStoreId, updatedAt: new Date() })
    .where(and(eq(agents.id, id), eq(agents.userId, userId)))
    .returning();

  return agent ?? null;
}

export async function listKnowledgeFiles(agentId: string) {
  return db
    .select()
    .from(agentKnowledgeFiles)
    .where(eq(agentKnowledgeFiles.agentId, agentId))
    .orderBy(desc(agentKnowledgeFiles.createdAt));
}

export async function createKnowledgeFile(input: CreateKnowledgeFileInput) {
  const values: NewAgentKnowledgeFile = {
    agentId: input.agentId,
    openaiFileId: input.openaiFileId,
    openaiVectorStoreFileId: input.openaiVectorStoreFileId,
    filename: input.filename,
    mimeType: input.mimeType,
    bytes: input.bytes,
    status: input.status ?? "in_progress",
    metadata: input.metadata ?? {},
  };

  const [file] = await db
    .insert(agentKnowledgeFiles)
    .values(values)
    .returning();

  if (!file) {
    throw new Error("Failed to create knowledge file");
  }

  return file;
}

export async function updateKnowledgeFileStatus(
  id: string,
  agentId: string,
  status: NewAgentKnowledgeFile["status"],
) {
  const [file] = await db
    .update(agentKnowledgeFiles)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(agentKnowledgeFiles.id, id),
        eq(agentKnowledgeFiles.agentId, agentId),
      ),
    )
    .returning();

  return file ?? null;
}

export async function getKnowledgeFileByIdForAgent(
  id: string,
  agentId: string,
) {
  const [file] = await db
    .select()
    .from(agentKnowledgeFiles)
    .where(
      and(
        eq(agentKnowledgeFiles.id, id),
        eq(agentKnowledgeFiles.agentId, agentId),
      ),
    );

  return file ?? null;
}

export async function deleteKnowledgeFileRecord(id: string, agentId: string) {
  const [file] = await db
    .delete(agentKnowledgeFiles)
    .where(
      and(
        eq(agentKnowledgeFiles.id, id),
        eq(agentKnowledgeFiles.agentId, agentId),
      ),
    )
    .returning();

  return file ?? null;
}

export async function listAgentTools(agentId: string) {
  return db
    .select()
    .from(agentTools)
    .where(eq(agentTools.agentId, agentId))
    .orderBy(asc(agentTools.createdAt));
}

export async function createAgentTool(input: CreateToolInput) {
  const values: NewAgentTool = {
    agentId: input.agentId,
    name: input.name,
    description: input.description,
    enabled: input.enabled ?? true,
    config: input.config ?? {},
  };

  const [tool] = await db.insert(agentTools).values(values).returning();

  if (!tool) {
    throw new Error("Failed to create tool");
  }

  return tool;
}

export async function updateAgentTool(
  id: string,
  agentId: string,
  input: UpdateToolInput,
) {
  const [tool] = await db
    .update(agentTools)
    .set(compactObject({ ...input, updatedAt: new Date() }))
    .where(and(eq(agentTools.id, id), eq(agentTools.agentId, agentId)))
    .returning();

  return tool ?? null;
}

export async function deleteAgentTool(id: string, agentId: string) {
  const [tool] = await db
    .delete(agentTools)
    .where(and(eq(agentTools.id, id), eq(agentTools.agentId, agentId)))
    .returning();

  return tool ?? null;
}

export async function listAgentMcpServers(agentId: string) {
  return db
    .select()
    .from(agentMcpServers)
    .where(eq(agentMcpServers.agentId, agentId))
    .orderBy(asc(agentMcpServers.createdAt));
}

export async function createAgentMcpServer(input: CreateMcpServerInput) {
  const values: NewAgentMcpServer = {
    agentId: input.agentId,
    name: input.name,
    serverUrl: input.serverUrl,
    command: input.command,
    transport: input.transport ?? "hosted",
    requireApproval: input.requireApproval ?? "never",
    enabled: input.enabled ?? true,
    toolFilter: input.toolFilter ?? {},
    metadata: input.metadata ?? {},
  };

  const [server] = await db.insert(agentMcpServers).values(values).returning();

  if (!server) {
    throw new Error("Failed to create MCP server");
  }

  return server;
}

export async function updateAgentMcpServer(
  id: string,
  agentId: string,
  input: UpdateMcpServerInput,
) {
  const [server] = await db
    .update(agentMcpServers)
    .set(compactObject({ ...input, updatedAt: new Date() }))
    .where(
      and(eq(agentMcpServers.id, id), eq(agentMcpServers.agentId, agentId)),
    )
    .returning();

  return server ?? null;
}

export async function deleteAgentMcpServer(id: string, agentId: string) {
  const [server] = await db
    .delete(agentMcpServers)
    .where(
      and(eq(agentMcpServers.id, id), eq(agentMcpServers.agentId, agentId)),
    )
    .returning();

  return server ?? null;
}
