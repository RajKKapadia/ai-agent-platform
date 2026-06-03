import {
  createAgentConnection,
  createAgentMcpServer,
  createAgentRecord,
  createAgentTool,
  createKnowledgeFile,
  deleteAgentByIdForUser,
  deleteAgentConnection,
  deleteAgentMcpServer,
  deleteAgentTool,
  deleteKnowledgeFileRecord,
  getAgentConnectionByIdForAgent,
  getAgentByIdForUser,
  getAgentConversationDetails,
  getAgentToolByIdForAgent,
  getKnowledgeFileByIdForAgent,
  getWhatsAppConnectionByPhoneNumberId,
  listAgentConversations,
  listAgentConnections,
  listAgentMcpServers,
  listAgentTools,
  listAgentsByUserId,
  listKnowledgeFiles,
  setAgentVectorStoreId,
  updateAgentConfiguration,
  updateAgentConnection,
  updateAgentMcpServer,
  updateAgentTool,
  type Agent,
  type AgentConnection,
  type AgentConversationDetails,
  type AgentConversationSummary,
  type AgentTool,
} from "@repo/db";
import { appConfig } from "@repo/config";
import {
  createAgentVectorStore,
  assertValidToolName,
  createStoredHttpApiToolConfig,
  deleteAgentVectorStore,
  deleteKnowledgeFile as deleteOpenAIKnowledgeFile,
  decryptSecret,
  encryptSecret,
  executeHttpApiTool,
  generateGuardrailPrompt,
  generateVerificationToken,
  hashSecret,
  toPublicHttpApiToolConfig,
  uploadKnowledgeFile as uploadOpenAIKnowledgeFile,
  validateOpenAIKey,
} from "@repo/agents";
import { Router, type Router as ExpressRouter } from "express";
import multer from "multer";
import { z } from "zod";
import { requireAuthenticatedUser } from "../auth";
import { HttpError, parseBody } from "../errors";

const metadataSchema = z.record(z.string(), z.unknown());

const validateKeySchema = z.object({
  apiKey: z.string().trim().min(1, "OpenAI API key is required"),
});

const generateGuardrailSchema = z.object({
  apiKey: z.string().trim().min(1, "OpenAI API key is required"),
  model: z.string().trim().min(1, "Model is required"),
  agentPrompt: z.string().trim().min(10, "Agent prompt is too short"),
});

const generateStoredAgentGuardrailSchema = z.object({
  model: z.string().trim().min(1, "Model is required"),
  agentPrompt: z.string().trim().min(10, "Agent prompt is too short"),
});

const createAgentSchema = z.object({
  name: z.string().trim().min(2, "Agent name must be at least 2 characters"),
  apiKey: z.string().trim().min(1, "OpenAI API key is required"),
  model: z.string().trim().min(1, "Model is required"),
  instructions: z.string().trim().min(10, "Agent prompt is too short"),
  guardrailEnabled: z.boolean().default(false),
  guardrailPrompt: z.string().trim().optional(),
  metadata: metadataSchema.default({}),
});

const updateAgentConfigurationSchema = z.object({
  name: z.string().trim().min(2, "Agent name must be at least 2 characters"),
  model: z.string().trim().min(1, "Model is required"),
  instructions: z.string().trim().min(10, "Agent prompt is too short"),
  status: z.enum(["active", "disabled"]),
  guardrailEnabled: z.boolean(),
  guardrailPrompt: z.string().trim().optional(),
});

const toolParameterSchema = z.object({
  name: z.string().trim().min(1, "Parameter name is required"),
  type: z.enum(["string", "number", "boolean", "object", "array"]),
  description: z.string().trim().min(1, "Parameter description is required"),
  required: z.boolean().default(false),
});

const toolHeaderSchema = z.object({
  name: z.string().trim().min(1, "Header name is required"),
  value: z.string().optional(),
});

const toolConfigSchema = z.object({
  type: z.literal("http_api").default("http_api"),
  method: z.enum(["GET", "POST"]),
  url: z.string().trim().min(1, "Endpoint URL is required"),
  parameters: z.array(toolParameterSchema).default([]),
  headers: z.array(toolHeaderSchema).default([]),
});

const createToolSchema = z.object({
  name: z.string().trim().min(2, "Tool name must be at least 2 characters"),
  description: z.string().trim().optional(),
  enabled: z.boolean().default(true),
  config: toolConfigSchema,
});

const updateToolSchema = createToolSchema;

const testToolSchema = z.object({
  toolId: z.string().uuid().optional(),
  config: toolConfigSchema,
  parameters: z.record(z.string(), z.unknown()).default({}),
});

const mcpServerBaseSchema = z.object({
  name: z.string().trim().min(2, "MCP name must be at least 2 characters"),
  serverUrl: z.string().trim().url().optional(),
  command: z.string().trim().optional(),
  transport: z.enum(["hosted", "streamable_http", "stdio"]).default("hosted"),
  requireApproval: z.enum(["never", "always"]).default("never"),
  enabled: z.boolean().default(true),
  toolFilter: metadataSchema.default({}),
  metadata: metadataSchema.default({}),
});

const createMcpServerSchema = mcpServerBaseSchema.superRefine(
  (value, context) => {
    if (value.transport === "stdio" && !value.command) {
      context.addIssue({
        code: "custom",
        message: "Command is required for stdio MCP servers",
        path: ["command"],
      });
    }

    if (value.transport !== "stdio" && !value.serverUrl) {
      context.addIssue({
        code: "custom",
        message:
          "Server URL is required for hosted and streamable HTTP MCP servers",
        path: ["serverUrl"],
      });
    }
  },
);

const updateMcpServerSchema = mcpServerBaseSchema.partial();

const createWhatsAppConnectionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Connection name must be at least 2 characters"),
  phoneNumberId: z.string().trim().min(1, "Phone number id is required"),
  accessToken: z.string().trim().min(1, "Access token is required"),
  appId: z.string().trim().min(1, "App id is required"),
  appSecret: z.string().trim().min(1, "App secret is required"),
  metadata: metadataSchema.default({}),
});

const updateWhatsAppConnectionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Connection name must be at least 2 characters"),
  phoneNumberId: z.string().trim().min(1, "Phone number id is required"),
  appId: z.string().trim().min(1, "App id is required"),
  accessToken: z.string().trim().optional(),
  appSecret: z.string().trim().optional(),
  metadata: metadataSchema.optional(),
});

const conversationListQuerySchema = z.object({
  channel: z.enum(["whatsapp"]).optional(),
  connectionId: z.string().uuid().optional(),
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

export const agentsRouter: ExpressRouter = Router();

function toPublicAgent(agent: Agent) {
  return {
    id: agent.id,
    userId: agent.userId,
    name: agent.name,
    instructions: agent.instructions,
    model: agent.model,
    status: agent.status,
    openaiApiKeyLastFour: agent.openaiApiKeyLastFour,
    openaiVectorStoreId: agent.openaiVectorStoreId,
    guardrailEnabled: agent.guardrailEnabled,
    guardrailPrompt: agent.guardrailPrompt,
    metadata: agent.metadata,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  };
}

function getWhatsAppWebhookUrl() {
  return new URL("/webhooks/meta/whatsapp", appConfig.api.publicUrl).toString();
}

function toPublicConnection(connection: AgentConnection) {
  return {
    id: connection.id,
    agentId: connection.agentId,
    userId: connection.userId,
    channel: connection.channel,
    name: connection.name,
    status: connection.status,
    externalId: connection.externalId,
    appId: connection.appId,
    accessTokenLastFour: connection.accessTokenLastFour,
    verificationToken: decryptSecret({
      ciphertext: connection.verificationTokenCiphertext,
      iv: connection.verificationTokenIv,
      authTag: connection.verificationTokenAuthTag,
    }),
    webhookUrl: getWhatsAppWebhookUrl(),
    metadata: connection.metadata,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}

function toPublicTool(tool: AgentTool) {
  return {
    ...tool,
    config: toPublicHttpApiToolConfig(tool.config),
  };
}

function getMetadataString(
  metadata: Record<string, unknown> | null,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

function toPublicMessage(
  message: NonNullable<AgentConversationSummary["lastMessage"]>,
) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    role: message.role,
    content: message.content,
    metadata: message.metadata,
    createdAt: message.createdAt,
  };
}

function toPublicConversationSummary(summary: AgentConversationSummary) {
  const conversationMetadata = summary.conversation.metadata;
  const channelConversation = summary.channelConversation;
  const connection = summary.connection;

  return {
    id: summary.conversation.id,
    agentId: summary.conversation.agentId,
    userId: summary.conversation.userId,
    title: summary.conversation.title,
    channel:
      connection?.channel ?? getMetadataString(conversationMetadata, "channel"),
    connectionId:
      channelConversation?.connectionId ??
      getMetadataString(conversationMetadata, "connectionId"),
    connectionName: connection?.name ?? null,
    externalContactId:
      channelConversation?.externalContactId ??
      getMetadataString(conversationMetadata, "externalContactId"),
    displayName:
      channelConversation?.displayName ?? summary.conversation.title ?? null,
    lastMessage: summary.lastMessage
      ? toPublicMessage(summary.lastMessage)
      : null,
    lastMessageAt: summary.lastMessageAt,
    messageCount: summary.messageCount,
    metadata: summary.conversation.metadata,
    channelMetadata: channelConversation?.metadata ?? null,
    createdAt: summary.conversation.createdAt,
    updatedAt: summary.conversation.updatedAt,
  };
}

function toPublicConversationDetails(details: AgentConversationDetails) {
  return {
    conversation: toPublicConversationSummary(details),
    messages: details.messages.map((message) => toPublicMessage(message)),
  };
}

function getOpenAIKey(agent: Agent): string {
  return decryptSecret({
    ciphertext: agent.openaiApiKeyCiphertext,
    iv: agent.openaiApiKeyIv,
    authTag: agent.openaiApiKeyAuthTag,
  });
}

async function deleteOpenAIKnowledgeFileBestEffort(input: {
  apiKey: string;
  vectorStoreId: string;
  openaiFileId: string;
  openaiVectorStoreFileId: string;
}) {
  await deleteOpenAIKnowledgeFile(input).catch(() => undefined);
}

function toOpenAIHttpError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof HttpError) {
    return error;
  }

  const maybeError = error as {
    status?: number;
    message?: string;
    error?: { message?: string };
  };
  const status = maybeError.status;
  const message =
    maybeError.error?.message ?? maybeError.message ?? fallbackMessage;

  if (typeof status === "number") {
    if (status === 401) {
      return new HttpError(401, "Invalid OpenAI API key");
    }

    return new HttpError(status >= 500 ? 502 : 400, message);
  }

  return error instanceof Error ? error : new Error(fallbackMessage);
}

function toToolHttpError(error: unknown): Error {
  if (error instanceof HttpError) {
    return error;
  }

  if (error instanceof Error) {
    return new HttpError(400, error.message);
  }

  return new HttpError(400, "Invalid tool configuration");
}

async function requireAgent(agentId: string, userId: string) {
  const agent = await getAgentByIdForUser(agentId, userId);

  if (!agent) {
    throw new HttpError(404, "Agent not found");
  }

  return agent;
}

async function assertAgentToolNameAvailable(input: {
  agentId: string;
  name: string;
  excludeToolId?: string;
}) {
  const normalizedName = assertValidToolName(input.name);
  const tools = await listAgentTools(input.agentId);
  const existingTool = tools.find(
    (tool) =>
      tool.name.toLowerCase() === normalizedName.toLowerCase() &&
      tool.id !== input.excludeToolId,
  );

  if (existingTool) {
    throw new HttpError(409, "A tool with this name already exists");
  }

  return normalizedName;
}

function getPathParam(
  request: { params: Record<string, string | undefined> },
  name: string,
): string {
  const value = request.params[name];

  if (!value) {
    throw new HttpError(400, `Missing route parameter: ${name}`);
  }

  return value;
}

function getQueryString(
  request: { query: Record<string, unknown> },
  name: string,
) {
  const value = request.query[name];

  if (typeof value === "string") {
    return value.trim() || undefined;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0].trim() || undefined;
  }

  return undefined;
}

agentsRouter.post("/validate-key", async (request, response, next) => {
  try {
    await requireAuthenticatedUser(request);
    const input = parseBody(validateKeySchema, request.body);
    const result = await validateOpenAIKey(input.apiKey);

    return response.status(200).json(result);
  } catch (error) {
    next(toOpenAIHttpError(error, "Failed to validate OpenAI API key"));
  }
});

agentsRouter.post("/generate-guardrail", async (request, response, next) => {
  try {
    await requireAuthenticatedUser(request);
    const input = parseBody(generateGuardrailSchema, request.body);
    const guardrailPrompt = await generateGuardrailPrompt(input);

    return response.status(200).json({ guardrailPrompt });
  } catch (error) {
    next(toOpenAIHttpError(error, "Failed to generate guardrail prompt"));
  }
});

agentsRouter.get("/", async (request, response, next) => {
  try {
    const { user } = await requireAuthenticatedUser(request);
    const agents = await listAgentsByUserId(user.id);

    return response.status(200).json({
      agents: agents.map(toPublicAgent),
    });
  } catch (error) {
    next(error);
  }
});

agentsRouter.post("/", async (request, response, next) => {
  try {
    const { user } = await requireAuthenticatedUser(request);
    const input = parseBody(createAgentSchema, request.body);
    const vectorStore = await createAgentVectorStore({
      apiKey: input.apiKey,
      name: `${input.name} knowledge base`,
      userId: user.id,
    });
    const encryptedApiKey = encryptSecret(input.apiKey);
    const guardrailPrompt =
      input.guardrailEnabled && !input.guardrailPrompt
        ? await generateGuardrailPrompt({
            apiKey: input.apiKey,
            model: input.model,
            agentPrompt: input.instructions,
          })
        : input.guardrailPrompt;

    const agent = await createAgentRecord({
      userId: user.id,
      name: input.name,
      instructions: input.instructions,
      model: input.model,
      openaiApiKeyCiphertext: encryptedApiKey.ciphertext,
      openaiApiKeyIv: encryptedApiKey.iv,
      openaiApiKeyAuthTag: encryptedApiKey.authTag,
      openaiApiKeyLastFour: input.apiKey.slice(-4),
      openaiVectorStoreId: vectorStore.id,
      guardrailEnabled: input.guardrailEnabled,
      guardrailPrompt: input.guardrailEnabled ? guardrailPrompt : null,
      metadata: input.metadata,
    });

    return response.status(201).json({ agent: toPublicAgent(agent) });
  } catch (error) {
    next(toOpenAIHttpError(error, "Failed to create agent"));
  }
});

agentsRouter.patch("/:agentId", async (request, response, next) => {
  try {
    const { user } = await requireAuthenticatedUser(request);
    const agent = await requireAgent(getPathParam(request, "agentId"), user.id);
    const input = parseBody(updateAgentConfigurationSchema, request.body);
    const guardrailPrompt =
      input.guardrailEnabled && !input.guardrailPrompt
        ? await generateGuardrailPrompt({
            apiKey: getOpenAIKey(agent),
            model: input.model,
            agentPrompt: input.instructions,
          })
        : input.guardrailPrompt;
    const updatedAgent = await updateAgentConfiguration(agent.id, user.id, {
      name: input.name,
      model: input.model,
      instructions: input.instructions,
      status: input.status,
      guardrailEnabled: input.guardrailEnabled,
      guardrailPrompt: input.guardrailEnabled ? guardrailPrompt : null,
    });

    if (!updatedAgent) {
      throw new HttpError(404, "Agent not found");
    }

    return response.status(200).json({ agent: toPublicAgent(updatedAgent) });
  } catch (error) {
    next(toOpenAIHttpError(error, "Failed to update agent"));
  }
});

agentsRouter.post(
  "/:agentId/generate-guardrail",
  async (request, response, next) => {
    try {
      const { user } = await requireAuthenticatedUser(request);
      const agent = await requireAgent(
        getPathParam(request, "agentId"),
        user.id,
      );
      const input = parseBody(
        generateStoredAgentGuardrailSchema,
        request.body,
      );
      const guardrailPrompt = await generateGuardrailPrompt({
        apiKey: getOpenAIKey(agent),
        model: input.model,
        agentPrompt: input.agentPrompt,
      });

      return response.status(200).json({ guardrailPrompt });
    } catch (error) {
      next(toOpenAIHttpError(error, "Failed to generate guardrail prompt"));
    }
  },
);

agentsRouter.get("/:agentId", async (request, response, next) => {
  try {
    const { user } = await requireAuthenticatedUser(request);
    const agent = await requireAgent(getPathParam(request, "agentId"), user.id);
    const [knowledgeFiles, tools, mcpServers, connections] = await Promise.all([
      listKnowledgeFiles(agent.id),
      listAgentTools(agent.id),
      listAgentMcpServers(agent.id),
      listAgentConnections(agent.id),
    ]);

    return response.status(200).json({
      agent: toPublicAgent(agent),
      knowledgeFiles,
      tools: tools.map(toPublicTool),
      mcpServers,
      connections: connections.map(toPublicConnection),
    });
  } catch (error) {
    next(error);
  }
});

agentsRouter.get(
  "/:agentId/conversations",
  async (request, response, next) => {
    try {
      const { user } = await requireAuthenticatedUser(request);
      const agent = await requireAgent(
        getPathParam(request, "agentId"),
        user.id,
      );
      const query = conversationListQuerySchema.parse({
        channel: getQueryString(request, "channel"),
        connectionId: getQueryString(request, "connectionId"),
        cursor: getQueryString(request, "cursor"),
        limit: getQueryString(request, "limit"),
      });
      const conversations = await listAgentConversations({
        agentId: agent.id,
        userId: user.id,
        channel: query.channel,
        connectionId: query.connectionId,
        cursor: query.cursor ? new Date(query.cursor) : undefined,
        limit: query.limit,
      });

      return response.status(200).json({
        conversations: conversations.map(toPublicConversationSummary),
      });
    } catch (error) {
      next(error);
    }
  },
);

agentsRouter.get(
  "/:agentId/conversations/:conversationId",
  async (request, response, next) => {
    try {
      const { user } = await requireAuthenticatedUser(request);
      const agent = await requireAgent(
        getPathParam(request, "agentId"),
        user.id,
      );
      const details = await getAgentConversationDetails({
        agentId: agent.id,
        userId: user.id,
        conversationId: getPathParam(request, "conversationId"),
      });

      if (!details) {
        throw new HttpError(404, "Conversation not found");
      }

      return response.status(200).json(toPublicConversationDetails(details));
    } catch (error) {
      next(error);
    }
  },
);

agentsRouter.delete("/:agentId", async (request, response, next) => {
  try {
    const { user } = await requireAuthenticatedUser(request);
    const agent = await requireAgent(getPathParam(request, "agentId"), user.id);
    const apiKey = getOpenAIKey(agent);
    const knowledgeFiles = await listKnowledgeFiles(agent.id);

    if (agent.openaiVectorStoreId) {
      await Promise.all(
        knowledgeFiles.map((file) =>
          deleteOpenAIKnowledgeFileBestEffort({
            apiKey,
            vectorStoreId: agent.openaiVectorStoreId ?? "",
            openaiFileId: file.openaiFileId,
            openaiVectorStoreFileId: file.openaiVectorStoreFileId,
          }),
        ),
      );
      await deleteAgentVectorStore({
        apiKey,
        vectorStoreId: agent.openaiVectorStoreId,
      });
    }

    const deletedAgent = await deleteAgentByIdForUser(agent.id, user.id);

    if (!deletedAgent) {
      throw new HttpError(404, "Agent not found");
    }

    return response.status(200).json({ ok: true });
  } catch (error) {
    next(toOpenAIHttpError(error, "Failed to delete agent"));
  }
});

agentsRouter.get(
  "/:agentId/connections",
  async (request, response, next) => {
    try {
      const { user } = await requireAuthenticatedUser(request);
      const agent = await requireAgent(
        getPathParam(request, "agentId"),
        user.id,
      );
      const connections = await listAgentConnections(agent.id);

      return response.status(200).json({
        connections: connections.map(toPublicConnection),
      });
    } catch (error) {
      next(error);
    }
  },
);

agentsRouter.post(
  "/:agentId/connections/whatsapp",
  async (request, response, next) => {
    try {
      const { user } = await requireAuthenticatedUser(request);
      const agent = await requireAgent(
        getPathParam(request, "agentId"),
        user.id,
      );
      const input = parseBody(createWhatsAppConnectionSchema, request.body);
      const existingAgentConnection = (await listAgentConnections(agent.id)).find(
        (connection) => connection.channel === "whatsapp",
      );

      if (existingAgentConnection) {
        throw new HttpError(409, "Agent already has a WhatsApp connection");
      }

      const existingPhoneConnection =
        await getWhatsAppConnectionByPhoneNumberId(input.phoneNumberId);

      if (existingPhoneConnection) {
        throw new HttpError(409, "Phone number id is already connected");
      }

      const verificationToken = generateVerificationToken();
      const encryptedAccessToken = encryptSecret(input.accessToken);
      const encryptedAppSecret = encryptSecret(input.appSecret);
      const encryptedVerificationToken = encryptSecret(verificationToken);
      const connection = await createAgentConnection({
        agentId: agent.id,
        userId: user.id,
        channel: "whatsapp",
        name: input.name,
        externalId: input.phoneNumberId,
        appId: input.appId,
        accessTokenCiphertext: encryptedAccessToken.ciphertext,
        accessTokenIv: encryptedAccessToken.iv,
        accessTokenAuthTag: encryptedAccessToken.authTag,
        accessTokenLastFour: input.accessToken.slice(-4),
        appSecretCiphertext: encryptedAppSecret.ciphertext,
        appSecretIv: encryptedAppSecret.iv,
        appSecretAuthTag: encryptedAppSecret.authTag,
        verificationTokenCiphertext: encryptedVerificationToken.ciphertext,
        verificationTokenIv: encryptedVerificationToken.iv,
        verificationTokenAuthTag: encryptedVerificationToken.authTag,
        verificationTokenHash: hashSecret(verificationToken),
        metadata: input.metadata,
      });

      return response.status(201).json({
        connection: toPublicConnection(connection),
      });
    } catch (error) {
      next(error);
    }
  },
);

agentsRouter.patch(
  "/:agentId/connections/:connectionId",
  async (request, response, next) => {
    try {
      const { user } = await requireAuthenticatedUser(request);
      const agent = await requireAgent(
        getPathParam(request, "agentId"),
        user.id,
      );
      const connection = await getAgentConnectionByIdForAgent(
        getPathParam(request, "connectionId"),
        agent.id,
      );

      if (!connection) {
        throw new HttpError(404, "Connection not found");
      }

      if (connection.channel !== "whatsapp") {
        throw new HttpError(400, "Only WhatsApp connections can be edited");
      }

      const input = parseBody(updateWhatsAppConnectionSchema, request.body);
      const phoneConnection = await getWhatsAppConnectionByPhoneNumberId(
        input.phoneNumberId,
      );

      if (phoneConnection && phoneConnection.id !== connection.id) {
        throw new HttpError(409, "Phone number id is already connected");
      }

      const encryptedAccessToken = input.accessToken
        ? encryptSecret(input.accessToken)
        : undefined;
      const encryptedAppSecret = input.appSecret
        ? encryptSecret(input.appSecret)
        : undefined;
      const updatedConnection = await updateAgentConnection(
        connection.id,
        agent.id,
        {
          name: input.name,
          externalId: input.phoneNumberId,
          appId: input.appId,
          accessTokenCiphertext: encryptedAccessToken?.ciphertext,
          accessTokenIv: encryptedAccessToken?.iv,
          accessTokenAuthTag: encryptedAccessToken?.authTag,
          accessTokenLastFour: input.accessToken?.slice(-4),
          appSecretCiphertext: encryptedAppSecret?.ciphertext,
          appSecretIv: encryptedAppSecret?.iv,
          appSecretAuthTag: encryptedAppSecret?.authTag,
          metadata: input.metadata,
        },
      );

      if (!updatedConnection) {
        throw new HttpError(404, "Connection not found");
      }

      return response.status(200).json({
        connection: toPublicConnection(updatedConnection),
      });
    } catch (error) {
      next(error);
    }
  },
);

agentsRouter.delete(
  "/:agentId/connections/:connectionId",
  async (request, response, next) => {
    try {
      const { user } = await requireAuthenticatedUser(request);
      const agent = await requireAgent(
        getPathParam(request, "agentId"),
        user.id,
      );
      const connection = await getAgentConnectionByIdForAgent(
        getPathParam(request, "connectionId"),
        agent.id,
      );

      if (!connection) {
        throw new HttpError(404, "Connection not found");
      }

      await deleteAgentConnection(connection.id, agent.id);

      return response.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  },
);

agentsRouter.post(
  "/:agentId/knowledge",
  upload.single("file"),
  async (request, response, next) => {
    try {
      const { user } = await requireAuthenticatedUser(request);
      let agent = await requireAgent(getPathParam(request, "agentId"), user.id);

      if (!request.file) {
        throw new HttpError(400, "Knowledge file is required");
      }

      const apiKey = getOpenAIKey(agent);

      if (!agent.openaiVectorStoreId) {
        const vectorStore = await createAgentVectorStore({
          apiKey,
          name: `${agent.name} knowledge base`,
          userId: user.id,
        });
        const updatedAgent = await setAgentVectorStoreId(
          agent.id,
          user.id,
          vectorStore.id,
        );

        if (!updatedAgent) {
          throw new HttpError(404, "Agent not found");
        }

        agent = updatedAgent;
      }

      if (!agent.openaiVectorStoreId) {
        throw new HttpError(500, "Agent vector store was not created");
      }

      const uploadedFile = await uploadOpenAIKnowledgeFile({
        apiKey,
        vectorStoreId: agent.openaiVectorStoreId,
        file: request.file,
      });
      let knowledgeFile;

      try {
        knowledgeFile = await createKnowledgeFile({
          agentId: agent.id,
          filename: request.file.originalname,
          mimeType: request.file.mimetype,
          bytes: request.file.size,
          ...uploadedFile,
        });
      } catch (error) {
        await deleteOpenAIKnowledgeFileBestEffort({
          apiKey,
          vectorStoreId: agent.openaiVectorStoreId,
          openaiFileId: uploadedFile.openaiFileId,
          openaiVectorStoreFileId: uploadedFile.openaiVectorStoreFileId,
        });

        throw error;
      }

      return response.status(201).json({ knowledgeFile });
    } catch (error) {
      next(toOpenAIHttpError(error, "Failed to upload knowledge file"));
    }
  },
);

agentsRouter.delete(
  "/:agentId/knowledge/:fileId",
  async (request, response, next) => {
    try {
      const { user } = await requireAuthenticatedUser(request);
      const agent = await requireAgent(
        getPathParam(request, "agentId"),
        user.id,
      );
      const file = await getKnowledgeFileByIdForAgent(
        getPathParam(request, "fileId"),
        agent.id,
      );

      if (!file) {
        throw new HttpError(404, "Knowledge file not found");
      }

      if (agent.openaiVectorStoreId) {
        await deleteOpenAIKnowledgeFile({
          apiKey: getOpenAIKey(agent),
          vectorStoreId: agent.openaiVectorStoreId,
          openaiFileId: file.openaiFileId,
          openaiVectorStoreFileId: file.openaiVectorStoreFileId,
        });
      }

      await deleteKnowledgeFileRecord(file.id, agent.id);

      return response.status(200).json({ ok: true });
    } catch (error) {
      next(toOpenAIHttpError(error, "Failed to delete knowledge file"));
    }
  },
);

agentsRouter.post("/:agentId/tools", async (request, response, next) => {
  try {
    const { user } = await requireAuthenticatedUser(request);
    const agent = await requireAgent(getPathParam(request, "agentId"), user.id);
    const input = parseBody(createToolSchema, request.body);
    const name = await assertAgentToolNameAvailable({
      agentId: agent.id,
      name: input.name,
    });
    const config = createStoredHttpApiToolConfig({
      config: input.config,
    });
    const tool = await createAgentTool({
      agentId: agent.id,
      name,
      description: input.description,
      enabled: input.enabled,
      config,
    });

    return response.status(201).json({ tool: toPublicTool(tool) });
  } catch (error) {
    next(toToolHttpError(error));
  }
});

agentsRouter.post("/:agentId/tools/test", async (request, response, next) => {
  try {
    const { user } = await requireAuthenticatedUser(request);
    const agent = await requireAgent(getPathParam(request, "agentId"), user.id);
    const input = parseBody(testToolSchema, request.body);
    const existingTool = input.toolId
      ? await getAgentToolByIdForAgent(input.toolId, agent.id)
      : null;

    if (input.toolId && !existingTool) {
      throw new HttpError(404, "Tool not found");
    }

    const config = createStoredHttpApiToolConfig({
      config: input.config,
      existingConfig: existingTool?.config,
    });
    const result = await executeHttpApiTool({
      config,
      parameters: input.parameters,
    });

    return response.status(200).json({ result });
  } catch (error) {
    next(toToolHttpError(error));
  }
});

agentsRouter.patch(
  "/:agentId/tools/:toolId",
  async (request, response, next) => {
    try {
      const { user } = await requireAuthenticatedUser(request);
      const agent = await requireAgent(
        getPathParam(request, "agentId"),
        user.id,
      );
      const input = parseBody(updateToolSchema, request.body);
      const toolId = getPathParam(request, "toolId");
      const existingTool = await getAgentToolByIdForAgent(toolId, agent.id);

      if (!existingTool) {
        throw new HttpError(404, "Tool not found");
      }

      const name = await assertAgentToolNameAvailable({
        agentId: agent.id,
        name: input.name,
        excludeToolId: toolId,
      });
      const config = createStoredHttpApiToolConfig({
        config: input.config,
        existingConfig: existingTool.config,
      });
      const tool = await updateAgentTool(
        toolId,
        agent.id,
        {
          name,
          description: input.description,
          enabled: input.enabled,
          config,
        },
      );

      if (!tool) {
        throw new HttpError(404, "Tool not found");
      }

      return response.status(200).json({ tool: toPublicTool(tool) });
    } catch (error) {
      next(toToolHttpError(error));
    }
  },
);

agentsRouter.delete(
  "/:agentId/tools/:toolId",
  async (request, response, next) => {
    try {
      const { user } = await requireAuthenticatedUser(request);
      const agent = await requireAgent(
        getPathParam(request, "agentId"),
        user.id,
      );
      const tool = await deleteAgentTool(
        getPathParam(request, "toolId"),
        agent.id,
      );

      if (!tool) {
        throw new HttpError(404, "Tool not found");
      }

      return response.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  },
);

agentsRouter.post("/:agentId/mcp-servers", async (request, response, next) => {
  try {
    const { user } = await requireAuthenticatedUser(request);
    const agent = await requireAgent(getPathParam(request, "agentId"), user.id);
    const input = parseBody(createMcpServerSchema, request.body);
    const mcpServer = await createAgentMcpServer({
      agentId: agent.id,
      ...input,
    });

    return response.status(201).json({ mcpServer });
  } catch (error) {
    next(error);
  }
});

agentsRouter.patch(
  "/:agentId/mcp-servers/:serverId",
  async (request, response, next) => {
    try {
      const { user } = await requireAuthenticatedUser(request);
      const agent = await requireAgent(
        getPathParam(request, "agentId"),
        user.id,
      );
      const input = parseBody(updateMcpServerSchema, request.body);
      const mcpServer = await updateAgentMcpServer(
        getPathParam(request, "serverId"),
        agent.id,
        input,
      );

      if (!mcpServer) {
        throw new HttpError(404, "MCP server not found");
      }

      return response.status(200).json({ mcpServer });
    } catch (error) {
      next(error);
    }
  },
);

agentsRouter.delete(
  "/:agentId/mcp-servers/:serverId",
  async (request, response, next) => {
    try {
      const { user } = await requireAuthenticatedUser(request);
      const agent = await requireAgent(
        getPathParam(request, "agentId"),
        user.id,
      );
      const mcpServer = await deleteAgentMcpServer(
        getPathParam(request, "serverId"),
        agent.id,
      );

      if (!mcpServer) {
        throw new HttpError(404, "MCP server not found");
      }

      return response.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  },
);
