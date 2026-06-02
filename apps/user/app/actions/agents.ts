"use server";

import {
  ApiError,
  createAgent,
  createAgentMcpServer,
  createWhatsAppConnection,
  createAgentTool,
  deleteAgentConnection,
  deleteAgentKnowledgeFile,
  deleteAgentMcpServer,
  deleteAgentTool,
  generateAgentGuardrail,
  uploadAgentKnowledgeFile,
  updateWhatsAppConnection,
  validateOpenAIKey,
} from "@/lib/api";
import type { ApiAgentConnection, CreateAgentInput } from "@/lib/api-types";
import { getSessionId } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

export interface AgentActionResult<TData = undefined> {
  data?: TData;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  success?: boolean;
}

const createAgentSchema = z.object({
  name: z.string().trim().min(2, "Agent name must be at least 2 characters"),
  apiKey: z.string().trim().min(1, "OpenAI API key is required"),
  model: z.string().trim().min(1, "Model is required"),
  instructions: z.string().trim().min(10, "Agent prompt is too short"),
  guardrailEnabled: z.boolean(),
  guardrailPrompt: z.string().trim().optional(),
});

const createToolSchema = z.object({
  name: z.string().trim().min(2, "Tool name must be at least 2 characters"),
  description: z.string().trim().optional(),
  enabled: z.boolean().default(true),
  config: z.string().trim().optional(),
});

const createMcpServerSchema = z.object({
  name: z.string().trim().min(2, "MCP name must be at least 2 characters"),
  serverUrl: z.string().trim().optional(),
  command: z.string().trim().optional(),
  transport: z.enum(["hosted", "streamable_http", "stdio"]),
  requireApproval: z.enum(["never", "always"]),
  enabled: z.boolean().default(true),
  toolFilter: z.string().trim().optional(),
});

const createWhatsAppConnectionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Connection name must be at least 2 characters"),
  phoneNumberId: z.string().trim().min(1, "Phone number id is required"),
  accessToken: z.string().trim().min(1, "Access token is required"),
  appId: z.string().trim().min(1, "App id is required"),
  appSecret: z.string().trim().min(1, "App secret is required"),
});

const updateWhatsAppConnectionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Connection name must be at least 2 characters"),
  phoneNumberId: z.string().trim().min(1, "Phone number id is required"),
  accessToken: z.string().trim().optional(),
  appId: z.string().trim().min(1, "App id is required"),
  appSecret: z.string().trim().optional(),
});

async function requireSessionId(): Promise<string> {
  const sessionId = await getSessionId();

  if (!sessionId) {
    redirect("/login");
  }

  return sessionId;
}

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getBoolean(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function parseJsonRecord(value: string | undefined): Record<string, unknown> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Expected a JSON object");
    }

    return parsed as Record<string, unknown>;
  } catch {
    throw new Error("Enter a valid JSON object");
  }
}

function actionError<TData = undefined>(
  error: unknown,
): AgentActionResult<TData> {
  if (error instanceof ApiError) {
    return { error: error.message };
  }

  if (error instanceof Error) {
    return { error: error.message };
  }

  return { error: "The request failed" };
}

export async function validateOpenAIKeyAction(
  apiKey: string,
): Promise<AgentActionResult<{ models: string[] }>> {
  try {
    const sessionId = await requireSessionId();
    const models = await validateOpenAIKey(sessionId, apiKey);

    return { data: { models } };
  } catch (error) {
    return actionError(error);
  }
}

export async function generateGuardrailAction(input: {
  apiKey: string;
  model: string;
  agentPrompt: string;
}): Promise<AgentActionResult<{ guardrailPrompt: string }>> {
  try {
    const sessionId = await requireSessionId();
    const guardrailPrompt = await generateAgentGuardrail({
      sessionId,
      ...input,
    });

    return { data: { guardrailPrompt } };
  } catch (error) {
    return actionError(error);
  }
}

export async function createAgentAction(
  input: CreateAgentInput,
): Promise<AgentActionResult<{ agentId: string }>> {
  const parsed = createAgentSchema.safeParse(input);

  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const sessionId = await requireSessionId();
    const agent = await createAgent(sessionId, parsed.data);

    revalidatePath("/dashboard");
    revalidatePath("/agents");

    return { data: { agentId: agent.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function uploadKnowledgeFileAction(
  agentId: string,
  _previousState: AgentActionResult,
  formData: FormData,
): Promise<AgentActionResult> {
  try {
    const sessionId = await requireSessionId();
    await uploadAgentKnowledgeFile(sessionId, agentId, formData);
    revalidatePath(`/agents/${agentId}`);

    return { success: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteKnowledgeFileAction(
  agentId: string,
  fileId: string,
) {
  const sessionId = await requireSessionId();
  await deleteAgentKnowledgeFile(sessionId, agentId, fileId);
  revalidatePath(`/agents/${agentId}`);
}

export async function createWhatsAppConnectionAction(
  agentId: string,
  _previousState: AgentActionResult<{ connection: ApiAgentConnection }>,
  formData: FormData,
): Promise<AgentActionResult<{ connection: ApiAgentConnection }>> {
  const parsed = createWhatsAppConnectionSchema.safeParse({
    name: getString(formData, "name"),
    phoneNumberId: getString(formData, "phoneNumberId"),
    accessToken: getString(formData, "accessToken"),
    appId: getString(formData, "appId"),
    appSecret: getString(formData, "appSecret"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const sessionId = await requireSessionId();
    const connection = await createWhatsAppConnection(
      sessionId,
      agentId,
      parsed.data,
    );

    revalidatePath(`/agents/${agentId}`);

    return {
      data: { connection },
      success: true,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateWhatsAppConnectionAction(
  agentId: string,
  connectionId: string,
  _previousState: AgentActionResult<{ connection: ApiAgentConnection }>,
  formData: FormData,
): Promise<AgentActionResult<{ connection: ApiAgentConnection }>> {
  const parsed = updateWhatsAppConnectionSchema.safeParse({
    name: getString(formData, "name"),
    phoneNumberId: getString(formData, "phoneNumberId"),
    accessToken: getString(formData, "accessToken") || undefined,
    appId: getString(formData, "appId"),
    appSecret: getString(formData, "appSecret") || undefined,
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const sessionId = await requireSessionId();
    const connection = await updateWhatsAppConnection(
      sessionId,
      agentId,
      connectionId,
      parsed.data,
    );

    revalidatePath(`/agents/${agentId}`);

    return {
      data: { connection },
      success: true,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteConnectionAction(
  agentId: string,
  connectionId: string,
) {
  const sessionId = await requireSessionId();
  await deleteAgentConnection(sessionId, agentId, connectionId);
  revalidatePath(`/agents/${agentId}`);
}

export async function createToolAction(
  agentId: string,
  _previousState: AgentActionResult,
  formData: FormData,
): Promise<AgentActionResult> {
  const parsed = createToolSchema.safeParse({
    name: getString(formData, "name"),
    description: getString(formData, "description") || undefined,
    enabled: getBoolean(formData, "enabled"),
    config: getString(formData, "config") || undefined,
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const sessionId = await requireSessionId();
    await createAgentTool(sessionId, agentId, {
      name: parsed.data.name,
      description: parsed.data.description,
      enabled: parsed.data.enabled,
      config: parseJsonRecord(parsed.data.config),
    });
    revalidatePath(`/agents/${agentId}`);

    return {};
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteToolAction(agentId: string, toolId: string) {
  const sessionId = await requireSessionId();
  await deleteAgentTool(sessionId, agentId, toolId);
  revalidatePath(`/agents/${agentId}`);
}

export async function createMcpServerAction(
  agentId: string,
  _previousState: AgentActionResult,
  formData: FormData,
): Promise<AgentActionResult> {
  const parsed = createMcpServerSchema.safeParse({
    name: getString(formData, "name"),
    serverUrl: getString(formData, "serverUrl") || undefined,
    command: getString(formData, "command") || undefined,
    transport: getString(formData, "transport"),
    requireApproval: getString(formData, "requireApproval"),
    enabled: getBoolean(formData, "enabled"),
    toolFilter: getString(formData, "toolFilter") || undefined,
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const sessionId = await requireSessionId();
    await createAgentMcpServer(sessionId, agentId, {
      name: parsed.data.name,
      serverUrl: parsed.data.serverUrl,
      command: parsed.data.command,
      transport: parsed.data.transport,
      requireApproval: parsed.data.requireApproval,
      enabled: parsed.data.enabled,
      toolFilter: parseJsonRecord(parsed.data.toolFilter),
    });
    revalidatePath(`/agents/${agentId}`);

    return {};
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteMcpServerAction(agentId: string, serverId: string) {
  const sessionId = await requireSessionId();
  await deleteAgentMcpServer(sessionId, agentId, serverId);
  revalidatePath(`/agents/${agentId}`);
}
