import { appConfig } from "@repo/config";
import {
  createMessageRecordIfNew,
  ensureChannelConversation,
  getAgentById,
  getAgentConnectionById,
  getConnectionEventById,
  getMessageByDedupeKey,
  listAgentMcpServers,
  updateConnectionEventStatus,
  type Agent,
  type AgentConnection,
  type ChannelConversation,
  type Message,
} from "@repo/db";
import { createHash } from "node:crypto";
import { decryptSecret } from "./crypto";
import { publishConversationUpdated } from "./conversation-events";
import { runAgentTextResponse } from "./runtime";
import { DbAgentSession } from "./session";
import type { AgentUserContext } from "./context";
import {
  isWhatsAppInboundMessagePayload,
  sendWhatsAppTextMessage,
  WhatsAppSendMessageError,
} from "./whatsapp";

function createWhatsAppMessageDedupeKey(input: {
  connectionId: string;
  messageId: string;
  role: "user" | "assistant";
}) {
  const hash = createHash("sha256")
    .update(`${input.connectionId}:${input.messageId}:${input.role}`)
    .digest("hex");

  return `whatsapp:${input.role}:${hash}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "The WhatsApp inbound job failed";
}

function isNonRetryableWhatsAppSendError(error: unknown): boolean {
  return (
    error instanceof WhatsAppSendMessageError &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  );
}

async function publishTranscriptUpdate(input: {
  agent: Agent;
  connection: AgentConnection;
  channelConversation: ChannelConversation;
  message: Message;
}) {
  await publishConversationUpdated({
    type: "conversation.updated",
    userId: input.connection.userId,
    agentId: input.agent.id,
    conversationId: input.channelConversation.conversationId,
    channelConversationId: input.channelConversation.id,
    connectionId: input.connection.id,
    channel: input.connection.channel,
    messageId: input.message.id,
    role: input.message.role,
    createdAt: input.message.createdAt.toISOString(),
  }).catch((error) => {
    console.error("Failed to publish conversation update", error);
  });
}

export async function processWhatsAppInboundMessage(input: {
  connectionEventId: string;
}): Promise<void> {
  const event = await getConnectionEventById(input.connectionEventId);

  if (!event) {
    throw new Error("Connection event not found");
  }

  if (event.status === "completed" || event.status === "ignored") {
    return;
  }

  await updateConnectionEventStatus(event.id, {
    status: "processing",
  });

  const connection = await getAgentConnectionById(event.connectionId);

  if (!connection || connection.status === "disabled") {
    await updateConnectionEventStatus(event.id, {
      status: "ignored",
      error: "Connection is missing or disabled",
    });
    return;
  }

  if (!isWhatsAppInboundMessagePayload(event.payload)) {
    await updateConnectionEventStatus(event.id, {
      status: "ignored",
      error: "Unsupported WhatsApp event payload",
    });
    return;
  }

  const agent = await getAgentById(connection.agentId);

  if (!agent || agent.status !== "active") {
    await updateConnectionEventStatus(event.id, {
      status: "ignored",
      error: "Agent is missing or disabled",
    });
    return;
  }

  const channelConversation = await ensureChannelConversation({
    connection,
    externalContactId: event.payload.from,
    displayName: event.payload.contactName,
    metadata: {
      phoneNumberId: event.payload.phoneNumberId,
    },
  });
  const session = new DbAgentSession({
    conversationId: channelConversation.conversationId,
  });
  const userContext: AgentUserContext = {
    agentId: agent.id,
    userId: connection.userId,
    conversationId: channelConversation.conversationId,
    channelConversationId: channelConversation.id,
    connectionId: connection.id,
    channel: connection.channel,
    externalContactId: event.payload.from,
    displayName: event.payload.contactName,
    phoneNumberId: event.payload.phoneNumberId,
    externalMessageId: event.payload.messageId,
    metadata: {
      inboundTimestamp: event.payload.timestamp,
    },
  };
  const inboundDedupeKey = createWhatsAppMessageDedupeKey({
    connectionId: connection.id,
    messageId: event.payload.messageId,
    role: "user",
  });
  const assistantDedupeKey = createWhatsAppMessageDedupeKey({
    connectionId: connection.id,
    messageId: event.payload.messageId,
    role: "assistant",
  });

  const inboundMessageResult = await createMessageRecordIfNew({
    conversationId: channelConversation.conversationId,
    connectionEventId: event.id,
    dedupeKey: inboundDedupeKey,
    role: "user",
    content: event.payload.text,
    metadata: {
      channel: "whatsapp",
      connectionId: connection.id,
      externalMessageId: event.payload.messageId,
      externalContactId: event.payload.from,
    },
  });

  if (
    !inboundMessageResult.created &&
    inboundMessageResult.message.connectionEventId !== event.id
  ) {
    await updateConnectionEventStatus(event.id, {
      status: "ignored",
      channelConversationId: channelConversation.id,
      error: "Duplicate WhatsApp message event",
    });
    return;
  }

  if (inboundMessageResult.created) {
    await publishTranscriptUpdate({
      agent,
      connection,
      channelConversation,
      message: inboundMessageResult.message,
    });
  }

  const existingAssistantMessage = await getMessageByDedupeKey(
    channelConversation.conversationId,
    assistantDedupeKey,
  );

  if (existingAssistantMessage) {
    await updateConnectionEventStatus(event.id, {
      status: "completed",
      channelConversationId: channelConversation.id,
    });
    return;
  }

  try {
    const apiKey = decryptSecret({
      ciphertext: agent.openaiApiKeyCiphertext,
      iv: agent.openaiApiKeyIv,
      authTag: agent.openaiApiKeyAuthTag,
    });
    const mcpServers = await listAgentMcpServers(agent.id);
    const generatedText = await runAgentTextResponse({
      agent,
      apiKey,
      mcpServers,
      message: event.payload.text,
      session,
      context: userContext,
    });
    const assistantText = generatedText || "I could not generate a response.";
    const accessToken = decryptSecret({
      ciphertext: connection.accessTokenCiphertext,
      iv: connection.accessTokenIv,
      authTag: connection.accessTokenAuthTag,
    });
    const sendResult = await sendWhatsAppTextMessage({
      graphApiBaseUrl: appConfig.meta.graphApiBaseUrl,
      phoneNumberId: connection.externalId,
      accessToken,
      to: event.payload.from,
      text: assistantText,
    });
    const { message, created } = await createMessageRecordIfNew({
      conversationId: channelConversation.conversationId,
      connectionEventId: event.id,
      dedupeKey: assistantDedupeKey,
      role: "assistant",
      content: assistantText,
      metadata: {
        channel: "whatsapp",
        connectionId: connection.id,
        deliveryStatus: "sent",
        externalMessageId: sendResult.messageId ?? null,
        replyToExternalMessageId: event.payload.messageId,
      },
    });

    if (created) {
      await publishTranscriptUpdate({
        agent,
        connection,
        channelConversation,
        message,
      });
    }
  } catch (error) {
    await updateConnectionEventStatus(event.id, {
      status: "failed",
      channelConversationId: channelConversation.id,
      error: getErrorMessage(error),
    });

    if (isNonRetryableWhatsAppSendError(error)) {
      return;
    }

    throw error;
  }

  await updateConnectionEventStatus(event.id, {
    status: "completed",
    channelConversationId: channelConversation.id,
  });
}
