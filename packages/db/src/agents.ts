import { asc, eq } from "drizzle-orm";
import { db } from "./client.js";
import { agents, type NewAgent } from "./schema.js";

export async function createAgent(input: NewAgent) {
  const [agent] = await db.insert(agents).values(input).returning();

  if (!agent) {
    throw new Error("Failed to create agent");
  }

  return agent;
}

export async function listAgents() {
  return db.select().from(agents).orderBy(asc(agents.createdAt));
}

export async function getAgentById(id: string) {
  const [agent] = await db.select().from(agents).where(eq(agents.id, id));
  return agent ?? null;
}
