import {
  Agent,
  OpenAIProvider,
  fileSearchTool,
  hostedMcpTool,
  type HostedTool,
  type RunConfig,
} from "@openai/agents";
import type { Agent as DbAgent, AgentMcpServer } from "@repo/db";

export interface AgentRuntime {
  agent: Agent;
  runConfig: RunConfig;
}

export function buildAgentRuntime(input: {
  agent: DbAgent;
  apiKey: string;
  mcpServers?: AgentMcpServer[];
}): AgentRuntime {
  const tools: HostedTool[] = [];

  if (input.agent.openaiVectorStoreId) {
    tools.push(fileSearchTool([input.agent.openaiVectorStoreId]));
  }

  for (const server of input.mcpServers ?? []) {
    if (!server.enabled || server.transport !== "hosted" || !server.serverUrl) {
      continue;
    }

    const hostedMcpConfig = {
      serverLabel: server.name,
      serverUrl: server.serverUrl,
    };

    tools.push(
      hostedMcpTool(
        server.requireApproval === "always"
          ? { ...hostedMcpConfig, requireApproval: "always" }
          : hostedMcpConfig,
      ),
    );
  }

  const agent = new Agent({
    name: input.agent.name,
    instructions: input.agent.instructions,
    model: input.agent.model,
    tools,
  });
  const runConfig: RunConfig = {
    modelProvider: new OpenAIProvider({ apiKey: input.apiKey }),
    tracingDisabled: false,
    traceIncludeSensitiveData: false,
  };

  return { agent, runConfig };
}
