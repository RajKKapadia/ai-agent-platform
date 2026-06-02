import {
  Agent,
  OpenAIProvider,
  Runner,
  fileSearchTool,
  hostedMcpTool,
  type HostedTool,
  type RunConfig,
  type Session,
} from "@openai/agents";
import type { Agent as DbAgent, AgentMcpServer } from "@repo/db";
import type { AgentUserContext } from "./context";

export interface AgentRuntime {
  agent: Agent<AgentUserContext>;
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

  const instructions = input.agent.guardrailEnabled
    ? [
        input.agent.instructions,
        "",
        "Guardrail:",
        input.agent.guardrailPrompt,
      ]
        .filter(Boolean)
        .join("\n")
    : input.agent.instructions;
  const agent = new Agent<AgentUserContext>({
    name: input.agent.name,
    instructions,
    model: input.agent.model,
    tools,
  });
  const runConfig: RunConfig = {
    modelProvider: new OpenAIProvider({ apiKey: input.apiKey }),
    tracingDisabled: true,
    traceIncludeSensitiveData: false,
  };

  return { agent, runConfig };
}

export async function runAgentTextResponse(input: {
  agent: DbAgent;
  apiKey: string;
  mcpServers?: AgentMcpServer[];
  message: string;
  session: Session;
  context: AgentUserContext;
}): Promise<string> {
  const runtime = buildAgentRuntime(input);
  const runner = new Runner(runtime.runConfig);
  const result = await runner.run(runtime.agent, input.message, {
    session: input.session,
    context: input.context,
  });
  const output = result.finalOutput;

  if (typeof output === "string") {
    return output;
  }

  if (output === undefined || output === null) {
    return "";
  }

  return JSON.stringify(output);
}
