import OpenAI, { toFile } from "openai";

export interface ValidatedOpenAIKey {
  models: string[];
}

export interface UploadedKnowledgeFile {
  openaiFileId: string;
  openaiVectorStoreFileId: string;
  status: "in_progress" | "completed" | "cancelled" | "failed";
}

export interface KnowledgeUploadFile {
  buffer: Buffer;
  originalname: string;
  mimetype?: string;
}

function createOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}

function isAgentModel(modelId: string): boolean {
  const id = modelId.toLowerCase();

  if (
    id.includes("embedding") ||
    id.includes("moderation") ||
    id.includes("whisper") ||
    id.includes("tts") ||
    id.includes("transcribe") ||
    id.includes("image") ||
    id.includes("dall-e")
  ) {
    return false;
  }

  return (
    id.startsWith("gpt-") || id.startsWith("o") || id.startsWith("chatgpt-")
  );
}

function sortModels(models: string[]): string[] {
  return Array.from(new Set(models)).sort((a, b) => a.localeCompare(b));
}

export async function validateOpenAIKey(
  apiKey: string,
): Promise<ValidatedOpenAIKey> {
  const client = createOpenAIClient(apiKey);
  const models = await client.models.list();
  const modelIds = models.data.map((model) => model.id);
  const agentModels = sortModels(modelIds.filter(isAgentModel));

  return {
    models: agentModels.length > 0 ? agentModels : sortModels(modelIds),
  };
}

export async function generateGuardrailPrompt(input: {
  apiKey: string;
  model: string;
  agentPrompt: string;
}): Promise<string> {
  const client = createOpenAIClient(input.apiKey);
  const response = await client.responses.create({
    model: input.model,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "Create a concise input guardrail prompt for this AI agent.",
              "The guardrail should identify unsafe, irrelevant, or policy-violating user requests for the agent's stated purpose.",
              "Return only the guardrail prompt text.",
              "",
              "Agent prompt:",
              input.agentPrompt,
            ].join("\n"),
          },
        ],
      },
    ],
  });

  return response.output_text.trim();
}

export async function createAgentVectorStore(input: {
  apiKey: string;
  name: string;
  userId: string;
}) {
  const client = createOpenAIClient(input.apiKey);

  return client.vectorStores.create({
    name: input.name,
    metadata: {
      userId: input.userId,
    },
  });
}

export async function uploadKnowledgeFile(input: {
  apiKey: string;
  vectorStoreId: string;
  file: KnowledgeUploadFile;
}): Promise<UploadedKnowledgeFile> {
  const client = createOpenAIClient(input.apiKey);
  const openaiFile = await client.files.create({
    file: await toFile(input.file.buffer, input.file.originalname, {
      type: input.file.mimetype,
    }),
    purpose: "assistants",
  });

  let vectorStoreFileId: string | undefined;

  try {
    const createdVectorStoreFile = await client.vectorStores.files.create(
      input.vectorStoreId,
      {
        file_id: openaiFile.id,
        attributes: {
          filename: input.file.originalname,
        },
      },
    );

    vectorStoreFileId = createdVectorStoreFile.id;

    const vectorStoreFile = await client.vectorStores.files.poll(
      input.vectorStoreId,
      createdVectorStoreFile.id,
      { pollIntervalMs: 1000 },
    );

    if (vectorStoreFile.status !== "completed") {
      throw new Error(
        `Vector store file processing ended with status: ${vectorStoreFile.status}`,
      );
    }

    return {
      openaiFileId: openaiFile.id,
      openaiVectorStoreFileId: vectorStoreFile.id,
      status: vectorStoreFile.status,
    };
  } catch (error) {
    if (vectorStoreFileId) {
      await client.vectorStores.files
        .delete(vectorStoreFileId, {
          vector_store_id: input.vectorStoreId,
        })
        .catch(() => undefined);
    }

    await client.files.delete(openaiFile.id).catch(() => undefined);

    throw error;
  }
}

export async function deleteKnowledgeFile(input: {
  apiKey: string;
  vectorStoreId: string;
  openaiFileId: string;
  openaiVectorStoreFileId: string;
}): Promise<void> {
  const client = createOpenAIClient(input.apiKey);

  await client.vectorStores.files
    .delete(input.openaiVectorStoreFileId, {
      vector_store_id: input.vectorStoreId,
    })
    .catch(() => undefined);
  await client.files.delete(input.openaiFileId).catch(() => undefined);
}
