import {
  appendAgentSessionItems,
  clearAgentSessionItems,
  listAgentSessionItems,
  popAgentSessionItem,
} from "@repo/db";
import type { AgentInputItem, Session } from "@openai/agents";

export interface DbAgentSessionInput {
  conversationId: string;
  sessionId?: string;
}

function toStoredItem(item: AgentInputItem): Record<string, unknown> {
  return item as unknown as Record<string, unknown>;
}

function toAgentInputItem(item: Record<string, unknown>): AgentInputItem {
  return item as unknown as AgentInputItem;
}

export class DbAgentSession implements Session {
  private readonly conversationId: string;
  private readonly sessionId: string;

  constructor(input: DbAgentSessionInput) {
    this.conversationId = input.conversationId;
    this.sessionId = input.sessionId ?? input.conversationId;
  }

  async getSessionId(): Promise<string> {
    return this.sessionId;
  }

  async getItems(limit?: number): Promise<AgentInputItem[]> {
    const items = await listAgentSessionItems({
      conversationId: this.conversationId,
      limit,
    });

    return items.map((item) => toAgentInputItem(item.item));
  }

  async addItems(items: AgentInputItem[]): Promise<void> {
    await appendAgentSessionItems({
      conversationId: this.conversationId,
      sessionId: this.sessionId,
      items: items.map(toStoredItem),
    });
  }

  async popItem(): Promise<AgentInputItem | undefined> {
    const item = await popAgentSessionItem({
      conversationId: this.conversationId,
    });

    return item ? toAgentInputItem(item.item) : undefined;
  }

  async clearSession(): Promise<void> {
    await clearAgentSessionItems({
      conversationId: this.conversationId,
    });
  }
}
