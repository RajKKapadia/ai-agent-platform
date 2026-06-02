import { appConfig } from "@repo/config";
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

const createRedisPublisher = () => {
  const client = createClient({
    url: appConfig.redis.url,
  });

  client.on("error", (error) => {
    console.error("Conversation event Redis publisher error", error);
  });

  return client;
};

type RedisPublisher = ReturnType<typeof createRedisPublisher>;

const globalForConversationEvents = globalThis as typeof globalThis & {
  __conversationEventPublisher?: RedisPublisher;
};

async function getConversationEventPublisher(): Promise<RedisPublisher> {
  const client =
    globalForConversationEvents.__conversationEventPublisher ??
    createRedisPublisher();
  globalForConversationEvents.__conversationEventPublisher = client;

  if (!client.isOpen) {
    await client.connect();
  }

  return client;
}

export async function publishConversationUpdated(
  event: ConversationUpdatedEvent,
): Promise<void> {
  const client = await getConversationEventPublisher();

  await client.publish(conversationEventsChannel, JSON.stringify(event));
}
