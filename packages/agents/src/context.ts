import type { AgentConnection } from "@repo/db";

export interface AgentUserContext {
  agentId: string;
  userId: string;
  conversationId: string;
  channelConversationId: string;
  connectionId: string;
  channel: AgentConnection["channel"];
  externalContactId: string;
  displayName?: string | null;
  phoneNumberId?: string;
  externalMessageId?: string;
  metadata: Record<string, unknown>;
}
