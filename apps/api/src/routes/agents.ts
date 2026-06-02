import {
  createAgentMcpServer,
  createAgentRecord,
  createAgentTool,
  createKnowledgeFile,
  deleteAgentMcpServer,
  deleteAgentTool,
  deleteKnowledgeFileRecord,
  getAgentByIdForUser,
  getKnowledgeFileByIdForAgent,
  listAgentMcpServers,
  listAgentTools,
  listAgentsByUserId,
  listKnowledgeFiles,
  setAgentVectorStoreId,
  updateAgentMcpServer,
  updateAgentTool,
  type Agent,
} from "@repo/db";
import { Router, type Router as ExpressRouter } from "express";
import multer from "multer";
import { z } from "zod";
import { requireAuthenticatedUser } from "../auth";
import { HttpError, parseBody } from "../errors";
import {
  createAgentVectorStore,
  deleteKnowledgeFile as deleteOpenAIKnowledgeFile,
  generateGuardrailPrompt,
  uploadKnowledgeFile as uploadOpenAIKnowledgeFile,
  validateOpenAIKey,
} from "../openai-service";
import { decryptSecret, encryptSecret } from "../secret-crypto";

const metadataSchema = z.record(z.string(), z.unknown());

const validateKeySchema = z.object({
  apiKey: z.string().trim().min(1, "OpenAI API key is required"),
});

const generateGuardrailSchema = z.object({
  apiKey: z.string().trim().min(1, "OpenAI API key is required"),
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

const createToolSchema = z.object({
  name: z.string().trim().min(2, "Tool name must be at least 2 characters"),
  description: z.string().trim().optional(),
  enabled: z.boolean().default(true),
  config: metadataSchema.default({}),
});

const updateToolSchema = createToolSchema.partial();

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

function getOpenAIKey(agent: Agent): string {
  return decryptSecret({
    ciphertext: agent.openaiApiKeyCiphertext,
    iv: agent.openaiApiKeyIv,
    authTag: agent.openaiApiKeyAuthTag,
  });
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

async function requireAgent(agentId: string, userId: string) {
  const agent = await getAgentByIdForUser(agentId, userId);

  if (!agent) {
    throw new HttpError(404, "Agent not found");
  }

  return agent;
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

agentsRouter.get("/:agentId", async (request, response, next) => {
  try {
    const { user } = await requireAuthenticatedUser(request);
    const agent = await requireAgent(getPathParam(request, "agentId"), user.id);
    const [knowledgeFiles, tools, mcpServers] = await Promise.all([
      listKnowledgeFiles(agent.id),
      listAgentTools(agent.id),
      listAgentMcpServers(agent.id),
    ]);

    return response.status(200).json({
      agent: toPublicAgent(agent),
      knowledgeFiles,
      tools,
      mcpServers,
    });
  } catch (error) {
    next(error);
  }
});

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
        await deleteOpenAIKnowledgeFile({
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
    const tool = await createAgentTool({
      agentId: agent.id,
      ...input,
    });

    return response.status(201).json({ tool });
  } catch (error) {
    next(error);
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
      const tool = await updateAgentTool(
        getPathParam(request, "toolId"),
        agent.id,
        input,
      );

      if (!tool) {
        throw new HttpError(404, "Tool not found");
      }

      return response.status(200).json({ tool });
    } catch (error) {
      next(error);
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
