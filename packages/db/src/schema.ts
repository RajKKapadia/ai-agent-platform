import { relations } from "drizzle-orm";
import {
  index,
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const messageRole = pgEnum("message_role", [
  "system",
  "user",
  "assistant",
  "tool",
]);

export const userRole = pgEnum("user_role", ["user", "admin"]);

export const agentStatus = pgEnum("agent_status", ["active", "disabled"]);

export const agentConnectionChannel = pgEnum("agent_connection_channel", [
  "whatsapp",
]);

export const agentConnectionStatus = pgEnum("agent_connection_status", [
  "pending",
  "active",
  "disabled",
]);

export const connectionEventStatus = pgEnum("connection_event_status", [
  "queued",
  "processing",
  "completed",
  "failed",
  "ignored",
]);

export const knowledgeFileStatus = pgEnum("knowledge_file_status", [
  "in_progress",
  "completed",
  "cancelled",
  "failed",
]);

export const mcpTransport = pgEnum("mcp_transport", [
  "hosted",
  "streamable_http",
  "stdio",
]);

export const mcpApprovalPolicy = pgEnum("mcp_approval_policy", [
  "never",
  "always",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").default("user").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
  ],
);

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    instructions: text("instructions").notNull(),
    model: varchar("model", { length: 128 }).notNull(),
    status: agentStatus("status").default("active").notNull(),
    openaiApiKeyCiphertext: text("openai_api_key_ciphertext").notNull(),
    openaiApiKeyIv: varchar("openai_api_key_iv", { length: 64 }).notNull(),
    openaiApiKeyAuthTag: varchar("openai_api_key_auth_tag", {
      length: 64,
    }).notNull(),
    openaiApiKeyLastFour: varchar("openai_api_key_last_four", {
      length: 16,
    }).notNull(),
    openaiVectorStoreId: varchar("openai_vector_store_id", { length: 128 }),
    guardrailEnabled: boolean("guardrail_enabled").default(false).notNull(),
    guardrailPrompt: text("guardrail_prompt"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("agents_user_id_idx").on(table.userId),
  ],
);

export const agentKnowledgeFiles = pgTable(
  "agent_knowledge_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    openaiFileId: varchar("openai_file_id", { length: 128 }).notNull(),
    openaiVectorStoreFileId: varchar("openai_vector_store_file_id", {
      length: 128,
    }).notNull(),
    filename: varchar("filename", { length: 512 }).notNull(),
    mimeType: varchar("mime_type", { length: 255 }),
    bytes: integer("bytes").notNull(),
    status: knowledgeFileStatus("status").default("in_progress").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("agent_knowledge_files_agent_id_idx").on(table.agentId),
    index("agent_knowledge_files_openai_file_id_idx").on(
      table.openaiFileId,
    ),
  ],
);

export const agentTools = pgTable(
  "agent_tools",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 128 }).notNull(),
    description: text("description"),
    enabled: boolean("enabled").default(true).notNull(),
    config: jsonb("config").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("agent_tools_agent_id_idx").on(table.agentId),
  ],
);

export const agentMcpServers = pgTable(
  "agent_mcp_servers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 128 }).notNull(),
    serverUrl: text("server_url"),
    command: text("command"),
    transport: mcpTransport("transport").default("hosted").notNull(),
    requireApproval: mcpApprovalPolicy("require_approval")
      .default("never")
      .notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    toolFilter: jsonb("tool_filter")
      .$type<Record<string, unknown>>()
      .default({}),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("agent_mcp_servers_agent_id_idx").on(table.agentId),
  ],
);

export const agentConnections = pgTable(
  "agent_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: agentConnectionChannel("channel").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    status: agentConnectionStatus("status").default("pending").notNull(),
    externalId: varchar("external_id", { length: 255 }).notNull(),
    appId: varchar("app_id", { length: 255 }).notNull(),
    accessTokenCiphertext: text("access_token_ciphertext").notNull(),
    accessTokenIv: varchar("access_token_iv", { length: 64 }).notNull(),
    accessTokenAuthTag: varchar("access_token_auth_tag", {
      length: 64,
    }).notNull(),
    accessTokenLastFour: varchar("access_token_last_four", {
      length: 16,
    }).notNull(),
    appSecretCiphertext: text("app_secret_ciphertext").notNull(),
    appSecretIv: varchar("app_secret_iv", { length: 64 }).notNull(),
    appSecretAuthTag: varchar("app_secret_auth_tag", {
      length: 64,
    }).notNull(),
    verificationTokenCiphertext: text(
      "verification_token_ciphertext",
    ).notNull(),
    verificationTokenIv: varchar("verification_token_iv", {
      length: 64,
    }).notNull(),
    verificationTokenAuthTag: varchar("verification_token_auth_tag", {
      length: 64,
    }).notNull(),
    verificationTokenHash: varchar("verification_token_hash", {
      length: 128,
    }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("agent_connections_agent_id_idx").on(table.agentId),
    index("agent_connections_user_id_idx").on(table.userId),
    uniqueIndex("agent_connections_agent_channel_idx").on(
      table.agentId,
      table.channel,
    ),
    uniqueIndex("agent_connections_channel_external_id_idx").on(
      table.channel,
      table.externalId,
    ),
    uniqueIndex("agent_connections_verification_token_hash_idx").on(
      table.verificationTokenHash,
    ),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("conversations_agent_id_idx").on(table.agentId),
    index("conversations_user_id_idx").on(table.userId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: messageRole("role").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("messages_conversation_id_idx").on(
      table.conversationId,
    ),
  ],
);

export const agentSessionItems = pgTable(
  "agent_session_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    sessionId: varchar("session_id", { length: 255 }).notNull(),
    sequence: integer("sequence").notNull(),
    item: jsonb("item").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("agent_session_items_conversation_id_idx").on(table.conversationId),
    index("agent_session_items_session_id_idx").on(table.sessionId),
    uniqueIndex("agent_session_items_conversation_sequence_idx").on(
      table.conversationId,
      table.sequence,
    ),
  ],
);

export const channelConversations = pgTable(
  "channel_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => agentConnections.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    externalContactId: varchar("external_contact_id", {
      length: 255,
    }).notNull(),
    displayName: varchar("display_name", { length: 255 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("channel_conversations_connection_id_idx").on(table.connectionId),
    index("channel_conversations_conversation_id_idx").on(
      table.conversationId,
    ),
    uniqueIndex("channel_conversations_contact_idx").on(
      table.connectionId,
      table.externalContactId,
    ),
  ],
);

export const connectionEvents = pgTable(
  "connection_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => agentConnections.id, { onDelete: "cascade" }),
    channelConversationId: uuid("channel_conversation_id").references(
      () => channelConversations.id,
      { onDelete: "set null" },
    ),
    externalEventId: varchar("external_event_id", { length: 255 }).notNull(),
    eventType: varchar("event_type", { length: 128 }).notNull(),
    status: connectionEventStatus("status").default("queued").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("connection_events_connection_id_idx").on(table.connectionId),
    index("connection_events_channel_conversation_id_idx").on(
      table.channelConversationId,
    ),
    uniqueIndex("connection_events_external_event_idx").on(
      table.connectionId,
      table.externalEventId,
    ),
  ],
);

export const agentsRelations = relations(agents, ({ one, many }) => ({
  user: one(users, {
    fields: [agents.userId],
    references: [users.id],
  }),
  conversations: many(conversations),
  connections: many(agentConnections),
  knowledgeFiles: many(agentKnowledgeFiles),
  tools: many(agentTools),
  mcpServers: many(agentMcpServers),
}));

export const usersRelations = relations(users, ({ many }) => ({
  agents: many(agents),
  connections: many(agentConnections),
  conversations: many(conversations),
}));

export const agentKnowledgeFilesRelations = relations(
  agentKnowledgeFiles,
  ({ one }) => ({
    agent: one(agents, {
      fields: [agentKnowledgeFiles.agentId],
      references: [agents.id],
    }),
  }),
);

export const agentToolsRelations = relations(agentTools, ({ one }) => ({
  agent: one(agents, {
    fields: [agentTools.agentId],
    references: [agents.id],
  }),
}));

export const agentMcpServersRelations = relations(
  agentMcpServers,
  ({ one }) => ({
    agent: one(agents, {
      fields: [agentMcpServers.agentId],
      references: [agents.id],
    }),
  }),
);

export const agentConnectionsRelations = relations(
  agentConnections,
  ({ one, many }) => ({
    agent: one(agents, {
      fields: [agentConnections.agentId],
      references: [agents.id],
    }),
    user: one(users, {
      fields: [agentConnections.userId],
      references: [users.id],
    }),
    channelConversations: many(channelConversations),
    events: many(connectionEvents),
  }),
);

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    agent: one(agents, {
      fields: [conversations.agentId],
      references: [agents.id],
    }),
    user: one(users, {
      fields: [conversations.userId],
      references: [users.id],
    }),
    messages: many(messages),
    sessionItems: many(agentSessionItems),
    channelConversations: many(channelConversations),
  }),
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const agentSessionItemsRelations = relations(
  agentSessionItems,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [agentSessionItems.conversationId],
      references: [conversations.id],
    }),
  }),
);

export const channelConversationsRelations = relations(
  channelConversations,
  ({ one, many }) => ({
    connection: one(agentConnections, {
      fields: [channelConversations.connectionId],
      references: [agentConnections.id],
    }),
    conversation: one(conversations, {
      fields: [channelConversations.conversationId],
      references: [conversations.id],
    }),
    events: many(connectionEvents),
  }),
);

export const connectionEventsRelations = relations(
  connectionEvents,
  ({ one }) => ({
    connection: one(agentConnections, {
      fields: [connectionEvents.connectionId],
      references: [agentConnections.id],
    }),
    channelConversation: one(channelConversations, {
      fields: [connectionEvents.channelConversationId],
      references: [channelConversations.id],
    }),
  }),
);

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type AgentKnowledgeFile = typeof agentKnowledgeFiles.$inferSelect;
export type NewAgentKnowledgeFile = typeof agentKnowledgeFiles.$inferInsert;
export type AgentTool = typeof agentTools.$inferSelect;
export type NewAgentTool = typeof agentTools.$inferInsert;
export type AgentMcpServer = typeof agentMcpServers.$inferSelect;
export type NewAgentMcpServer = typeof agentMcpServers.$inferInsert;
export type AgentConnection = typeof agentConnections.$inferSelect;
export type NewAgentConnection = typeof agentConnections.$inferInsert;
export type ChannelConversation = typeof channelConversations.$inferSelect;
export type NewChannelConversation =
  typeof channelConversations.$inferInsert;
export type ConnectionEvent = typeof connectionEvents.$inferSelect;
export type NewConnectionEvent = typeof connectionEvents.$inferInsert;
export type AgentSessionItem = typeof agentSessionItems.$inferSelect;
export type NewAgentSessionItem = typeof agentSessionItems.$inferInsert;
export type UserRole = "user" | "admin";
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
