import { appConfig } from "@repo/config";
import {
  createMessageRecord,
  ensureChannelConversation,
  getAgentById,
  getAgentConnectionById,
  getConnectionEventById,
  listAgentMcpServers,
  updateConnectionEventStatus,
} from "@repo/db";
import { decryptSecret } from "./crypto";
import { runAgentTextResponse } from "./runtime";
import { DbAgentSession } from "./session";
import type { AgentUserContext } from "./context";
import {
  isWhatsAppInboundMessagePayload,
  sendWhatsAppTextMessage,
} from "./whatsapp";

export async function processWhatsAppInboundMessage(input: {
  connectionEventId: string;
}): Promise<void> {
  await updateConnectionEventStatus(input.connectionEventId, {
    status: "processing",
  });

  const event = await getConnectionEventById(input.connectionEventId);

  if (!event) {
    throw new Error("Connection event not found");
  }

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

  await createMessageRecord({
    conversationId: channelConversation.conversationId,
    role: "user",
    content: event.payload.text,
    metadata: {
      channel: "whatsapp",
      connectionId: connection.id,
      externalMessageId: event.payload.messageId,
      externalContactId: event.payload.from,
    },
  });

  const apiKey = decryptSecret({
    ciphertext: agent.openaiApiKeyCiphertext,
    iv: agent.openaiApiKeyIv,
    authTag: agent.openaiApiKeyAuthTag,
  });
  const mcpServers = await listAgentMcpServers(agent.id);
  const assistantText = await runAgentTextResponse({
    agent,
    apiKey,
    mcpServers,
    message: event.payload.text,
    session,
    context: userContext,
  });

  await createMessageRecord({
    conversationId: channelConversation.conversationId,
    role: "assistant",
    content: assistantText,
    metadata: {
      channel: "whatsapp",
      connectionId: connection.id,
      replyToExternalMessageId: event.payload.messageId,
    },
  });

  const accessToken = decryptSecret({
    ciphertext: connection.accessTokenCiphertext,
    iv: connection.accessTokenIv,
    authTag: connection.accessTokenAuthTag,
  });

  await sendWhatsAppTextMessage({
    graphApiBaseUrl: appConfig.meta.graphApiBaseUrl,
    phoneNumberId: connection.externalId,
    accessToken,
    to: event.payload.from,
    text: assistantText || "I could not generate a response.",
  });

  await updateConnectionEventStatus(event.id, {
    status: "completed",
    channelConversationId: channelConversation.id,
  });
}
