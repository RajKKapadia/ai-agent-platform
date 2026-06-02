import "server-only";

import { getRuntimeRedisConfig } from "@repo/config/runtime";
import { createClient } from "redis";

export const conversationEventsChannel = "agent-platform:conversation-events";

export interface ConversationUpdatedEvent {
  type: "conversation.updated";
  userId: string;
  agentId: string;
  conversationId: string;
  channelConversationId: string;
  connectionId: string;
  channel: string;
  messageId: string;
  role: string;
  createdAt: string;
}

export function createConversationEventsSubscriber() {
  const redisConfig = getRuntimeRedisConfig();
  const client = createClient({
    url: redisConfig.url,
  });

  client.on("error", (error: unknown) => {
    console.error("Conversation event Redis subscriber error", error);
  });

  return client;
}

export function parseConversationUpdatedEvent(
  value: string,
): ConversationUpdatedEvent | null {
  const data = JSON.parse(value) as Partial<ConversationUpdatedEvent>;

  if (
    data.type !== "conversation.updated" ||
    typeof data.userId !== "string" ||
    typeof data.agentId !== "string" ||
    typeof data.conversationId !== "string" ||
    typeof data.channelConversationId !== "string" ||
    typeof data.connectionId !== "string" ||
    typeof data.channel !== "string" ||
    typeof data.messageId !== "string" ||
    typeof data.role !== "string" ||
    typeof data.createdAt !== "string"
  ) {
    return null;
  }

  return data as ConversationUpdatedEvent;
}
