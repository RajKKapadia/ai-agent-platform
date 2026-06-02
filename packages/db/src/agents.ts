import { and, asc, count, desc, eq, lt, sql, type SQL } from "drizzle-orm";
import { db } from "./client";
import {
  agentConnections,
  agentKnowledgeFiles,
  agentMcpServers,
  agentSessionItems,
  agentTools,
  agents,
  channelConversations,
  connectionEvents,
  conversations,
  messages,
  type AgentConnection,
  type AgentSessionItem,
  type ChannelConversation,
  type Conversation,
  type ConnectionEvent,
  type Message,
  type NewAgent,
  type NewAgentConnection,
  type NewAgentSessionItem,
  type NewChannelConversation,
  type NewConnectionEvent,
  type NewAgentKnowledgeFile,
  type NewAgentMcpServer,
  type NewAgentTool,
  type NewConversation,
  type NewMessage,
} from "./schema";

export interface CreateAgentRecordInput {
  userId: string;
  name: string;
  instructions: string;
  model: string;
  openaiApiKeyCiphertext: string;
  openaiApiKeyIv: string;
  openaiApiKeyAuthTag: string;
  openaiApiKeyLastFour: string;
  openaiVectorStoreId?: string | null;
  guardrailEnabled?: boolean;
  guardrailPrompt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateAgentConfigurationInput {
  name?: string;
  instructions?: string;
  model?: string;
  status?: NewAgent["status"];
  guardrailEnabled?: boolean;
  guardrailPrompt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateKnowledgeFileInput {
  agentId: string;
  openaiFileId: string;
  openaiVectorStoreFileId: string;
  filename: string;
  mimeType?: string | null;
  bytes: number;
  status?: NewAgentKnowledgeFile["status"];
  metadata?: Record<string, unknown>;
}

export interface CreateToolInput {
  agentId: string;
  name: string;
  description?: string | null;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

export interface UpdateToolInput {
  name?: string;
  description?: string | null;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

export interface CreateMcpServerInput {
  agentId: string;
  name: string;
  serverUrl?: string | null;
  command?: string | null;
  transport?: NewAgentMcpServer["transport"];
  requireApproval?: NewAgentMcpServer["requireApproval"];
  enabled?: boolean;
  toolFilter?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UpdateMcpServerInput {
  name?: string;
  serverUrl?: string | null;
  command?: string | null;
  transport?: NewAgentMcpServer["transport"];
  requireApproval?: NewAgentMcpServer["requireApproval"];
  enabled?: boolean;
  toolFilter?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface CreateAgentConnectionInput {
  agentId: string;
  userId: string;
  channel: NewAgentConnection["channel"];
  name: string;
  status?: NewAgentConnection["status"];
  externalId: string;
  appId: string;
  accessTokenCiphertext: string;
  accessTokenIv: string;
  accessTokenAuthTag: string;
  accessTokenLastFour: string;
  appSecretCiphertext: string;
  appSecretIv: string;
  appSecretAuthTag: string;
  verificationTokenCiphertext: string;
  verificationTokenIv: string;
  verificationTokenAuthTag: string;
  verificationTokenHash: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateAgentConnectionInput {
  name?: string;
  status?: NewAgentConnection["status"];
  externalId?: string;
  appId?: string;
  accessTokenCiphertext?: string;
  accessTokenIv?: string;
  accessTokenAuthTag?: string;
  accessTokenLastFour?: string;
  appSecretCiphertext?: string;
  appSecretIv?: string;
  appSecretAuthTag?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateConnectionEventInput {
  connectionId: string;
  externalEventId: string;
  eventType: string;
  status?: NewConnectionEvent["status"];
  payload?: Record<string, unknown>;
}

export interface EnsureChannelConversationInput {
  connection: AgentConnection;
  externalContactId: string;
  displayName?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ConnectionEventStatusInput {
  status: NewConnectionEvent["status"];
  channelConversationId?: string | null;
  error?: string | null;
}

export interface ListAgentConversationsInput {
  agentId: string;
  userId: string;
  limit?: number;
  cursor?: Date;
  channel?: NewAgentConnection["channel"];
  connectionId?: string;
}

export interface AgentConversationSummary {
  conversation: Conversation;
  channelConversation: ChannelConversation | null;
  connection: AgentConnection | null;
  lastMessage: Message | null;
  lastMessageAt: Date;
  messageCount: number;
}

export interface AgentConversationDetails extends AgentConversationSummary {
  messages: Message[];
}

function compactObject<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as T;
}

export async function createAgent(input: NewAgent) {
  const [agent] = await db.insert(agents).values(input).returning();

  if (!agent) {
    throw new Error("Failed to create agent");
  }

  return agent;
}

export async function createAgentRecord(input: CreateAgentRecordInput) {
  return createAgent({
    userId: input.userId,
    name: input.name,
    instructions: input.instructions,
    model: input.model,
    openaiApiKeyCiphertext: input.openaiApiKeyCiphertext,
    openaiApiKeyIv: input.openaiApiKeyIv,
    openaiApiKeyAuthTag: input.openaiApiKeyAuthTag,
    openaiApiKeyLastFour: input.openaiApiKeyLastFour,
    openaiVectorStoreId: input.openaiVectorStoreId,
    guardrailEnabled: input.guardrailEnabled ?? false,
    guardrailPrompt: input.guardrailPrompt,
    metadata: input.metadata ?? {},
  });
}

export async function listAgents() {
  return db.select().from(agents).orderBy(asc(agents.createdAt));
}

export async function listAgentsByUserId(userId: string) {
  return db
    .select()
    .from(agents)
    .where(eq(agents.userId, userId))
    .orderBy(desc(agents.createdAt));
}

export async function getAgentById(id: string) {
  const [agent] = await db.select().from(agents).where(eq(agents.id, id));
  return agent ?? null;
}

export async function getAgentByIdForUser(id: string, userId: string) {
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.userId, userId)));

  return agent ?? null;
}

export async function updateAgentConfiguration(
  id: string,
  userId: string,
  input: UpdateAgentConfigurationInput,
) {
  const [agent] = await db
    .update(agents)
    .set(compactObject({ ...input, updatedAt: new Date() }))
    .where(and(eq(agents.id, id), eq(agents.userId, userId)))
    .returning();

  return agent ?? null;
}

export async function deleteAgentByIdForUser(id: string, userId: string) {
  const [agent] = await db
    .delete(agents)
    .where(and(eq(agents.id, id), eq(agents.userId, userId)))
    .returning();

  return agent ?? null;
}

export async function setAgentVectorStoreId(
  id: string,
  userId: string,
  openaiVectorStoreId: string,
) {
  const [agent] = await db
    .update(agents)
    .set({ openaiVectorStoreId, updatedAt: new Date() })
    .where(and(eq(agents.id, id), eq(agents.userId, userId)))
    .returning();

  return agent ?? null;
}

export async function listKnowledgeFiles(agentId: string) {
  return db
    .select()
    .from(agentKnowledgeFiles)
    .where(eq(agentKnowledgeFiles.agentId, agentId))
    .orderBy(desc(agentKnowledgeFiles.createdAt));
}

export async function createKnowledgeFile(input: CreateKnowledgeFileInput) {
  const values: NewAgentKnowledgeFile = {
    agentId: input.agentId,
    openaiFileId: input.openaiFileId,
    openaiVectorStoreFileId: input.openaiVectorStoreFileId,
    filename: input.filename,
    mimeType: input.mimeType,
    bytes: input.bytes,
    status: input.status ?? "in_progress",
    metadata: input.metadata ?? {},
  };

  const [file] = await db
    .insert(agentKnowledgeFiles)
    .values(values)
    .returning();

  if (!file) {
    throw new Error("Failed to create knowledge file");
  }

  return file;
}

export async function updateKnowledgeFileStatus(
  id: string,
  agentId: string,
  status: NewAgentKnowledgeFile["status"],
) {
  const [file] = await db
    .update(agentKnowledgeFiles)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(agentKnowledgeFiles.id, id),
        eq(agentKnowledgeFiles.agentId, agentId),
      ),
    )
    .returning();

  return file ?? null;
}

export async function getKnowledgeFileByIdForAgent(
  id: string,
  agentId: string,
) {
  const [file] = await db
    .select()
    .from(agentKnowledgeFiles)
    .where(
      and(
        eq(agentKnowledgeFiles.id, id),
        eq(agentKnowledgeFiles.agentId, agentId),
      ),
    );

  return file ?? null;
}

export async function deleteKnowledgeFileRecord(id: string, agentId: string) {
  const [file] = await db
    .delete(agentKnowledgeFiles)
    .where(
      and(
        eq(agentKnowledgeFiles.id, id),
        eq(agentKnowledgeFiles.agentId, agentId),
      ),
    )
    .returning();

  return file ?? null;
}

export async function listAgentTools(agentId: string) {
  return db
    .select()
    .from(agentTools)
    .where(eq(agentTools.agentId, agentId))
    .orderBy(asc(agentTools.createdAt));
}

export async function createAgentTool(input: CreateToolInput) {
  const values: NewAgentTool = {
    agentId: input.agentId,
    name: input.name,
    description: input.description,
    enabled: input.enabled ?? true,
    config: input.config ?? {},
  };

  const [tool] = await db.insert(agentTools).values(values).returning();

  if (!tool) {
    throw new Error("Failed to create tool");
  }

  return tool;
}

export async function updateAgentTool(
  id: string,
  agentId: string,
  input: UpdateToolInput,
) {
  const [tool] = await db
    .update(agentTools)
    .set(compactObject({ ...input, updatedAt: new Date() }))
    .where(and(eq(agentTools.id, id), eq(agentTools.agentId, agentId)))
    .returning();

  return tool ?? null;
}

export async function deleteAgentTool(id: string, agentId: string) {
  const [tool] = await db
    .delete(agentTools)
    .where(and(eq(agentTools.id, id), eq(agentTools.agentId, agentId)))
    .returning();

  return tool ?? null;
}

export async function listAgentMcpServers(agentId: string) {
  return db
    .select()
    .from(agentMcpServers)
    .where(eq(agentMcpServers.agentId, agentId))
    .orderBy(asc(agentMcpServers.createdAt));
}

export async function createAgentMcpServer(input: CreateMcpServerInput) {
  const values: NewAgentMcpServer = {
    agentId: input.agentId,
    name: input.name,
    serverUrl: input.serverUrl,
    command: input.command,
    transport: input.transport ?? "hosted",
    requireApproval: input.requireApproval ?? "never",
    enabled: input.enabled ?? true,
    toolFilter: input.toolFilter ?? {},
    metadata: input.metadata ?? {},
  };

  const [server] = await db.insert(agentMcpServers).values(values).returning();

  if (!server) {
    throw new Error("Failed to create MCP server");
  }

  return server;
}

export async function updateAgentMcpServer(
  id: string,
  agentId: string,
  input: UpdateMcpServerInput,
) {
  const [server] = await db
    .update(agentMcpServers)
    .set(compactObject({ ...input, updatedAt: new Date() }))
    .where(
      and(eq(agentMcpServers.id, id), eq(agentMcpServers.agentId, agentId)),
    )
    .returning();

  return server ?? null;
}

export async function deleteAgentMcpServer(id: string, agentId: string) {
  const [server] = await db
    .delete(agentMcpServers)
    .where(
      and(eq(agentMcpServers.id, id), eq(agentMcpServers.agentId, agentId)),
    )
    .returning();

  return server ?? null;
}

export async function listAgentConnections(agentId: string) {
  return db
    .select()
    .from(agentConnections)
    .where(eq(agentConnections.agentId, agentId))
    .orderBy(desc(agentConnections.createdAt));
}

export async function getAgentConnectionById(id: string) {
  const [connection] = await db
    .select()
    .from(agentConnections)
    .where(eq(agentConnections.id, id));

  return connection ?? null;
}

export async function getAgentConnectionByIdForAgent(
  id: string,
  agentId: string,
) {
  const [connection] = await db
    .select()
    .from(agentConnections)
    .where(
      and(eq(agentConnections.id, id), eq(agentConnections.agentId, agentId)),
    );

  return connection ?? null;
}

export async function getAgentConnectionByVerificationTokenHash(
  verificationTokenHash: string,
) {
  const [connection] = await db
    .select()
    .from(agentConnections)
    .where(eq(agentConnections.verificationTokenHash, verificationTokenHash));

  return connection ?? null;
}

export async function getWhatsAppConnectionByPhoneNumberId(
  phoneNumberId: string,
) {
  const [connection] = await db
    .select()
    .from(agentConnections)
    .where(
      and(
        eq(agentConnections.channel, "whatsapp"),
        eq(agentConnections.externalId, phoneNumberId),
      ),
    );

  return connection ?? null;
}

export async function createAgentConnection(
  input: CreateAgentConnectionInput,
) {
  const values: NewAgentConnection = {
    agentId: input.agentId,
    userId: input.userId,
    channel: input.channel,
    name: input.name,
    status: input.status ?? "pending",
    externalId: input.externalId,
    appId: input.appId,
    accessTokenCiphertext: input.accessTokenCiphertext,
    accessTokenIv: input.accessTokenIv,
    accessTokenAuthTag: input.accessTokenAuthTag,
    accessTokenLastFour: input.accessTokenLastFour,
    appSecretCiphertext: input.appSecretCiphertext,
    appSecretIv: input.appSecretIv,
    appSecretAuthTag: input.appSecretAuthTag,
    verificationTokenCiphertext: input.verificationTokenCiphertext,
    verificationTokenIv: input.verificationTokenIv,
    verificationTokenAuthTag: input.verificationTokenAuthTag,
    verificationTokenHash: input.verificationTokenHash,
    metadata: input.metadata ?? {},
  };

  const [connection] = await db
    .insert(agentConnections)
    .values(values)
    .returning();

  if (!connection) {
    throw new Error("Failed to create agent connection");
  }

  return connection;
}

export async function markAgentConnectionActive(id: string) {
  const [connection] = await db
    .update(agentConnections)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(agentConnections.id, id))
    .returning();

  return connection ?? null;
}

export async function deleteAgentConnection(id: string, agentId: string) {
  const [connection] = await db
    .delete(agentConnections)
    .where(
      and(eq(agentConnections.id, id), eq(agentConnections.agentId, agentId)),
    )
    .returning();

  return connection ?? null;
}

export async function updateAgentConnection(
  id: string,
  agentId: string,
  input: UpdateAgentConnectionInput,
) {
  const [connection] = await db
    .update(agentConnections)
    .set(compactObject({ ...input, updatedAt: new Date() }))
    .where(
      and(eq(agentConnections.id, id), eq(agentConnections.agentId, agentId)),
    )
    .returning();

  return connection ?? null;
}

export async function getConnectionEventById(id: string) {
  const [event] = await db
    .select()
    .from(connectionEvents)
    .where(eq(connectionEvents.id, id));

  return event ?? null;
}

export async function createConnectionEventIfNew(
  input: CreateConnectionEventInput,
): Promise<{ event: ConnectionEvent; created: boolean }> {
  const values: NewConnectionEvent = {
    connectionId: input.connectionId,
    externalEventId: input.externalEventId,
    eventType: input.eventType,
    status: input.status ?? "queued",
    payload: input.payload ?? {},
  };

  const [createdEvent] = await db
    .insert(connectionEvents)
    .values(values)
    .onConflictDoNothing({
      target: [
        connectionEvents.connectionId,
        connectionEvents.externalEventId,
      ],
    })
    .returning();

  if (createdEvent) {
    return { event: createdEvent, created: true };
  }

  const [event] = await db
    .select()
    .from(connectionEvents)
    .where(
      and(
        eq(connectionEvents.connectionId, input.connectionId),
        eq(connectionEvents.externalEventId, input.externalEventId),
      ),
    );

  if (!event) {
    throw new Error("Failed to load connection event");
  }

  return { event, created: false };
}

export async function updateConnectionEventStatus(
  id: string,
  input: ConnectionEventStatusInput,
) {
  const [event] = await db
    .update(connectionEvents)
    .set(
      compactObject({
        status: input.status,
        channelConversationId: input.channelConversationId,
        error: input.error,
        updatedAt: new Date(),
      }),
    )
    .where(eq(connectionEvents.id, id))
    .returning();

  return event ?? null;
}

export async function createConversationRecord(input: NewConversation) {
  const [conversation] = await db
    .insert(conversations)
    .values(input)
    .returning();

  if (!conversation) {
    throw new Error("Failed to create conversation");
  }

  return conversation;
}

export async function createMessageRecord(input: NewMessage) {
  const { message } = await createMessageRecordIfNew(input);

  return message;
}

export async function createMessageRecordIfNew(
  input: NewMessage,
): Promise<{ message: Message; created: boolean }> {
  if (input.dedupeKey) {
    const [createdMessage] = await db
      .insert(messages)
      .values(input)
      .onConflictDoNothing({
        target: [messages.conversationId, messages.dedupeKey],
      })
      .returning();

    if (createdMessage) {
      return { message: createdMessage, created: true };
    }

    const [existingMessage] = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, input.conversationId),
          eq(messages.dedupeKey, input.dedupeKey),
        ),
      );

    if (!existingMessage) {
      throw new Error("Failed to load existing message");
    }

    return { message: existingMessage, created: false };
  }

  const [message] = await db.insert(messages).values(input).returning();

  if (!message) {
    throw new Error("Failed to create message");
  }

  return { message, created: true };
}

export async function getMessageByDedupeKey(
  conversationId: string,
  dedupeKey: string,
): Promise<Message | null> {
  const [message] = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.dedupeKey, dedupeKey),
      ),
    );

  return message ?? null;
}

export async function listAgentConversations(
  input: ListAgentConversationsInput,
): Promise<AgentConversationSummary[]> {
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const messageStats = db
    .select({
      conversationId: messages.conversationId,
      lastMessageAt: sql<Date>`max(${messages.createdAt})`.as(
        "last_message_at",
      ),
      messageCount: count(messages.id).as("message_count"),
    })
    .from(messages)
    .groupBy(messages.conversationId)
    .as("message_stats");
  const lastActivityAt = sql<Date>`coalesce(${messageStats.lastMessageAt}, ${conversations.createdAt})`;
  const conditions: SQL[] = [
    eq(conversations.agentId, input.agentId),
    eq(conversations.userId, input.userId),
  ];

  if (input.cursor) {
    conditions.push(lt(lastActivityAt, input.cursor));
  }

  if (input.channel) {
    conditions.push(eq(agentConnections.channel, input.channel));
  }

  if (input.connectionId) {
    conditions.push(eq(channelConversations.connectionId, input.connectionId));
  }

  const rows = await db
    .select({
      conversation: conversations,
      channelConversation: channelConversations,
      connection: agentConnections,
      lastMessageAt: messageStats.lastMessageAt,
      messageCount: messageStats.messageCount,
    })
    .from(conversations)
    .leftJoin(
      channelConversations,
      eq(channelConversations.conversationId, conversations.id),
    )
    .leftJoin(
      agentConnections,
      eq(agentConnections.id, channelConversations.connectionId),
    )
    .leftJoin(
      messageStats,
      eq(messageStats.conversationId, conversations.id),
    )
    .where(and(...conditions))
    .orderBy(desc(lastActivityAt), desc(conversations.createdAt))
    .limit(limit);

  return Promise.all(
    rows.map(async (row) => {
      const [lastMessage] = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, row.conversation.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      return {
        conversation: row.conversation,
        channelConversation: row.channelConversation,
        connection: row.connection,
        lastMessage: lastMessage ?? null,
        lastMessageAt:
          row.lastMessageAt ?? lastMessage?.createdAt ?? row.conversation.createdAt,
        messageCount: Number(row.messageCount ?? 0),
      };
    }),
  );
}

export async function getAgentConversationDetails(input: {
  agentId: string;
  userId: string;
  conversationId: string;
}): Promise<AgentConversationDetails | null> {
  const [row] = await db
    .select({
      conversation: conversations,
      channelConversation: channelConversations,
      connection: agentConnections,
    })
    .from(conversations)
    .leftJoin(
      channelConversations,
      eq(channelConversations.conversationId, conversations.id),
    )
    .leftJoin(
      agentConnections,
      eq(agentConnections.id, channelConversations.connectionId),
    )
    .where(
      and(
        eq(conversations.id, input.conversationId),
        eq(conversations.agentId, input.agentId),
        eq(conversations.userId, input.userId),
      ),
    );

  if (!row) {
    return null;
  }

  const conversationMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, row.conversation.id))
    .orderBy(asc(messages.createdAt));
  const lastMessage =
    conversationMessages.length > 0
      ? (conversationMessages[conversationMessages.length - 1] ?? null)
      : null;

  return {
    conversation: row.conversation,
    channelConversation: row.channelConversation,
    connection: row.connection,
    lastMessage,
    lastMessageAt: lastMessage?.createdAt ?? row.conversation.createdAt,
    messageCount: conversationMessages.length,
    messages: conversationMessages,
  };
}

export async function getChannelConversation(
  connectionId: string,
  externalContactId: string,
) {
  const [channelConversation] = await db
    .select()
    .from(channelConversations)
    .where(
      and(
        eq(channelConversations.connectionId, connectionId),
        eq(channelConversations.externalContactId, externalContactId),
      ),
    );

  return channelConversation ?? null;
}

export async function ensureChannelConversation(
  input: EnsureChannelConversationInput,
): Promise<ChannelConversation> {
  const existing = await getChannelConversation(
    input.connection.id,
    input.externalContactId,
  );

  if (existing) {
    return existing;
  }

  return db.transaction(async (transaction) => {
    const conversationValues: NewConversation = {
      agentId: input.connection.agentId,
      userId: input.connection.userId,
      title: input.displayName ?? input.externalContactId,
      metadata: {
        channel: input.connection.channel,
        connectionId: input.connection.id,
        externalContactId: input.externalContactId,
        ...(input.metadata ?? {}),
      },
    };
    const [conversation] = await transaction
      .insert(conversations)
      .values(conversationValues)
      .returning();

    if (!conversation) {
      throw new Error("Failed to create conversation");
    }

    const channelConversationValues: NewChannelConversation = {
      connectionId: input.connection.id,
      conversationId: conversation.id,
      externalContactId: input.externalContactId,
      displayName: input.displayName,
      metadata: input.metadata ?? {},
    };
    const [channelConversation] = await transaction
      .insert(channelConversations)
      .values(channelConversationValues)
      .returning();

    if (!channelConversation) {
      throw new Error("Failed to create channel conversation");
    }

    return channelConversation;
  });
}

export async function listAgentSessionItems(input: {
  conversationId: string;
  limit?: number;
}): Promise<AgentSessionItem[]> {
  if (input.limit && input.limit > 0) {
    const items = await db
      .select()
      .from(agentSessionItems)
      .where(eq(agentSessionItems.conversationId, input.conversationId))
      .orderBy(desc(agentSessionItems.sequence))
      .limit(input.limit);

    return items.reverse();
  }

  return db
    .select()
    .from(agentSessionItems)
    .where(eq(agentSessionItems.conversationId, input.conversationId))
    .orderBy(asc(agentSessionItems.sequence));
}

export async function appendAgentSessionItems(input: {
  conversationId: string;
  sessionId: string;
  items: Array<Record<string, unknown>>;
}): Promise<AgentSessionItem[]> {
  if (input.items.length === 0) {
    return [];
  }

  return db.transaction(async (transaction) => {
    const [lastItem] = await transaction
      .select({ sequence: agentSessionItems.sequence })
      .from(agentSessionItems)
      .where(eq(agentSessionItems.conversationId, input.conversationId))
      .orderBy(desc(agentSessionItems.sequence))
      .limit(1);
    const firstSequence = (lastItem?.sequence ?? 0) + 1;
    const values: NewAgentSessionItem[] = input.items.map((item, index) => ({
      conversationId: input.conversationId,
      sessionId: input.sessionId,
      sequence: firstSequence + index,
      item,
    }));

    return transaction.insert(agentSessionItems).values(values).returning();
  });
}

export async function popAgentSessionItem(input: {
  conversationId: string;
}): Promise<AgentSessionItem | undefined> {
  const [lastItem] = await db
    .select()
    .from(agentSessionItems)
    .where(eq(agentSessionItems.conversationId, input.conversationId))
    .orderBy(desc(agentSessionItems.sequence))
    .limit(1);

  if (!lastItem) {
    return undefined;
  }

  const [deletedItem] = await db
    .delete(agentSessionItems)
    .where(eq(agentSessionItems.id, lastItem.id))
    .returning();

  return deletedItem;
}

export async function clearAgentSessionItems(input: {
  conversationId: string;
}): Promise<void> {
  await db
    .delete(agentSessionItems)
    .where(eq(agentSessionItems.conversationId, input.conversationId));
}

export async function countAgentSessionItems(input: {
  conversationId: string;
}): Promise<number> {
  const items = await db
    .select({ id: agentSessionItems.id })
    .from(agentSessionItems)
    .where(eq(agentSessionItems.conversationId, input.conversationId));

  return items.length;
}
