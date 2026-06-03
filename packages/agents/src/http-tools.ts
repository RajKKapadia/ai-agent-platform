import { tool, type Tool } from "@openai/agents";
import { appConfig } from "@repo/config";
import type { AgentTool } from "@repo/db";
import type { AgentUserContext } from "./context";
import { decryptSecret, encryptSecret } from "./crypto";

export type HttpApiToolMethod = "GET" | "POST";
export type HttpApiToolParameterType =
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "array";

export interface HttpApiToolParameter {
  name: string;
  type: HttpApiToolParameterType;
  description: string;
  required: boolean;
}

export interface HttpApiToolHeaderInput {
  name: string;
  value?: string;
}

export interface StoredHttpApiToolHeader {
  name: string;
  encryptedValue: string;
  iv: string;
  authTag: string;
  valuePreview: string;
}

export interface PublicHttpApiToolHeader {
  name: string;
  valuePreview: string;
}

export interface HttpApiToolConfigInput extends Record<string, unknown> {
  type?: "http_api";
  method: HttpApiToolMethod;
  url: string;
  parameters?: HttpApiToolParameter[];
  headers?: HttpApiToolHeaderInput[];
}

export interface StoredHttpApiToolConfig extends Record<string, unknown> {
  type: "http_api";
  method: HttpApiToolMethod;
  url: string;
  parameters: HttpApiToolParameter[];
  headers: StoredHttpApiToolHeader[];
}

export interface PublicHttpApiToolConfig extends Record<string, unknown> {
  type: "http_api";
  method: HttpApiToolMethod;
  url: string;
  parameters: HttpApiToolParameter[];
  headers: PublicHttpApiToolHeader[];
}

export interface HttpApiToolTestResult {
  ok: boolean;
  status: number;
  bodyPreview: string;
  headersPreview: Record<string, string>;
}

const toolNamePattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
const headerNamePattern = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const parameterTypes = new Set<HttpApiToolParameterType>([
  "string",
  "number",
  "boolean",
  "object",
  "array",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isHttpApiToolMethod(value: unknown): value is HttpApiToolMethod {
  return value === "GET" || value === "POST";
}

function isHttpApiToolParameterType(
  value: unknown,
): value is HttpApiToolParameterType {
  return (
    typeof value === "string" &&
    parameterTypes.has(value as HttpApiToolParameterType)
  );
}

function normalizeName(value: string, label: string) {
  const name = value.trim();

  if (!toolNamePattern.test(name)) {
    throw new Error(
      `${label} must start with a letter or underscore and contain only letters, numbers, and underscores`,
    );
  }

  return name;
}

function normalizeHeaderName(value: string) {
  const name = value.trim();

  if (!headerNamePattern.test(name)) {
    throw new Error(
      "Header names can contain only letters, numbers, hyphens, and underscores",
    );
  }

  return name;
}

function normalizeUrl(value: string) {
  const url = new URL(value.trim());

  if (url.username || url.password) {
    throw new Error("Tool endpoint URLs cannot include credentials");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Tool endpoint URL must use http or https");
  }

  const isLocalhost =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1";

  if (url.protocol === "http:" && (appConfig.isProduction || !isLocalhost)) {
    throw new Error("HTTP tool endpoints must use https outside localhost");
  }

  return url.toString();
}

function valuePreview(value: string) {
  const suffix = value.slice(-4);
  return suffix ? `****${suffix}` : "****";
}

function toEncryptedHeader(name: string, value: string): StoredHttpApiToolHeader {
  const encrypted = encryptSecret(value);

  return {
    name,
    encryptedValue: encrypted.ciphertext,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
    valuePreview: valuePreview(value),
  };
}

function decryptHeader(header: StoredHttpApiToolHeader) {
  return decryptSecret({
    ciphertext: header.encryptedValue,
    iv: header.iv,
    authTag: header.authTag,
  });
}

function isStoredHeader(value: unknown): value is StoredHttpApiToolHeader {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.encryptedValue === "string" &&
    typeof value.iv === "string" &&
    typeof value.authTag === "string" &&
    typeof value.valuePreview === "string"
  );
}

function isParameter(value: unknown): value is HttpApiToolParameter {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    isHttpApiToolParameterType(value.type) &&
    typeof value.description === "string" &&
    typeof value.required === "boolean"
  );
}

function normalizeParameters(
  parameters: HttpApiToolParameter[] | undefined,
): HttpApiToolParameter[] {
  const seen = new Set<string>();

  return (parameters ?? []).map((parameter) => {
    const name = normalizeName(parameter.name, "Parameter name");
    const key = name.toLowerCase();

    if (seen.has(key)) {
      throw new Error(`Duplicate parameter name: ${name}`);
    }

    seen.add(key);

    if (!isHttpApiToolParameterType(parameter.type)) {
      throw new Error(`Unsupported parameter type for ${name}`);
    }

    const description = parameter.description.trim();

    if (!description) {
      throw new Error(`Description is required for parameter ${name}`);
    }

    return {
      name,
      type: parameter.type,
      description,
      required: Boolean(parameter.required),
    };
  });
}

function getExistingHeader(
  existingConfig: StoredHttpApiToolConfig | undefined,
  name: string,
) {
  return existingConfig?.headers.find(
    (header) => header.name.toLowerCase() === name.toLowerCase(),
  );
}

function normalizeHeaders(input: {
  headers: HttpApiToolHeaderInput[] | undefined;
  existingConfig?: StoredHttpApiToolConfig;
}): StoredHttpApiToolHeader[] {
  const seen = new Set<string>();

  return (input.headers ?? []).map((header) => {
    const name = normalizeHeaderName(header.name);
    const key = name.toLowerCase();

    if (seen.has(key)) {
      throw new Error(`Duplicate header name: ${name}`);
    }

    seen.add(key);

    const value = header.value?.trim();

    if (value) {
      return toEncryptedHeader(name, value);
    }

    const existingHeader = getExistingHeader(input.existingConfig, name);

    if (!existingHeader) {
      throw new Error(`Header value is required for ${name}`);
    }

    return {
      ...existingHeader,
      name,
    };
  });
}

export function assertValidToolName(name: string): string {
  return normalizeName(name, "Tool name");
}

export function isStoredHttpApiToolConfig(
  value: unknown,
): value is StoredHttpApiToolConfig {
  return (
    isRecord(value) &&
    value.type === "http_api" &&
    isHttpApiToolMethod(value.method) &&
    typeof value.url === "string" &&
    Array.isArray(value.parameters) &&
    value.parameters.every(isParameter) &&
    Array.isArray(value.headers) &&
    value.headers.every(isStoredHeader)
  );
}

export function createStoredHttpApiToolConfig(input: {
  config: HttpApiToolConfigInput;
  existingConfig?: unknown;
}): StoredHttpApiToolConfig {
  const existingConfig = isStoredHttpApiToolConfig(input.existingConfig)
    ? input.existingConfig
    : undefined;
  const method = input.config.method;

  if (!isHttpApiToolMethod(method)) {
    throw new Error("Tool method must be GET or POST");
  }

  return {
    type: "http_api",
    method,
    url: normalizeUrl(input.config.url),
    parameters: normalizeParameters(input.config.parameters),
    headers: normalizeHeaders({
      headers: input.config.headers,
      existingConfig,
    }),
  };
}

export function toPublicHttpApiToolConfig(
  config: unknown,
): PublicHttpApiToolConfig | Record<string, unknown> | null {
  if (!isStoredHttpApiToolConfig(config)) {
    return isRecord(config) ? config : null;
  }

  return {
    type: "http_api",
    method: config.method,
    url: config.url,
    parameters: config.parameters,
    headers: config.headers.map((header) => ({
      name: header.name,
      valuePreview: header.valuePreview,
    })),
  };
}

function getHeaderMap(config: StoredHttpApiToolConfig) {
  const headers = new Headers();

  for (const header of config.headers) {
    headers.set(header.name, decryptHeader(header));
  }

  if (config.method === "POST" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}

function coerceParameterValue(
  parameter: HttpApiToolParameter,
  value: unknown,
): unknown {
  if (value === undefined || value === null || value === "") {
    if (parameter.required) {
      throw new Error(`Missing required parameter: ${parameter.name}`);
    }

    return undefined;
  }

  if (parameter.type === "string") {
    return String(value);
  }

  if (parameter.type === "number") {
    const numberValue = typeof value === "number" ? value : Number(value);

    if (Number.isNaN(numberValue)) {
      throw new Error(`Parameter ${parameter.name} must be a number`);
    }

    return numberValue;
  }

  if (parameter.type === "boolean") {
    if (typeof value === "boolean") {
      return value;
    }

    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }

    throw new Error(`Parameter ${parameter.name} must be a boolean`);
  }

  if (parameter.type === "object") {
    if (isRecord(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = JSON.parse(value) as unknown;

      if (isRecord(parsed)) {
        return parsed;
      }
    }

    throw new Error(`Parameter ${parameter.name} must be a JSON object`);
  }

  if (parameter.type === "array") {
    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = JSON.parse(value) as unknown;

      if (Array.isArray(parsed)) {
        return parsed;
      }
    }

    throw new Error(`Parameter ${parameter.name} must be a JSON array`);
  }

  return value;
}

function normalizeArguments(
  config: StoredHttpApiToolConfig,
  args: Record<string, unknown>,
) {
  const normalized: Record<string, unknown> = {};

  for (const parameter of config.parameters) {
    const value = coerceParameterValue(parameter, args[parameter.name]);

    if (value !== undefined) {
      normalized[parameter.name] = value;
    }
  }

  return normalized;
}

function createParameterJsonSchema(parameter: HttpApiToolParameter) {
  const base = {
    description: parameter.description,
  };

  if (parameter.type === "array") {
    return {
      ...base,
      type: "array",
      items: {},
    };
  }

  if (parameter.type === "object") {
    return {
      ...base,
      type: "object",
      additionalProperties: true,
    };
  }

  return {
    ...base,
    type: parameter.type,
  };
}

function createJsonSchema(config: StoredHttpApiToolConfig) {
  return {
    type: "object",
    additionalProperties: false,
    properties: Object.fromEntries(
      config.parameters.map((parameter) => [
        parameter.name,
        createParameterJsonSchema(parameter),
      ]),
    ),
    required: config.parameters
      .filter((parameter) => parameter.required)
      .map((parameter) => parameter.name),
  } as const;
}

function appendSearchParams(url: URL, args: Record<string, unknown>) {
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === "object") {
      url.searchParams.set(key, JSON.stringify(value));
    } else {
      url.searchParams.set(key, String(value));
    }
  }
}

function previewResponseHeaders(headers: Headers) {
  const preview: Record<string, string> = {};

  for (const [name, value] of headers.entries()) {
    if (
      ["content-type", "content-length", "x-request-id"].includes(
        name.toLowerCase(),
      )
    ) {
      preview[name] = value;
    }
  }

  return preview;
}

export async function executeHttpApiTool(input: {
  config: StoredHttpApiToolConfig;
  parameters: Record<string, unknown>;
}): Promise<HttpApiToolTestResult> {
  const args = normalizeArguments(input.config, input.parameters);
  const url = new URL(input.config.url);
  const headers = getHeaderMap(input.config);
  const requestInit: RequestInit = {
    method: input.config.method,
    headers,
    signal: AbortSignal.timeout(15000),
  };

  if (input.config.method === "GET") {
    appendSearchParams(url, args);
  } else {
    requestInit.body = JSON.stringify(args);
  }

  const response = await fetch(url, requestInit);
  const bodyPreview = (await response.text().catch(() => "")).slice(0, 4000);

  return {
    ok: response.ok,
    status: response.status,
    bodyPreview,
    headersPreview: previewResponseHeaders(response.headers),
  };
}

function formatToolResult(result: HttpApiToolTestResult) {
  return JSON.stringify({
    ok: result.ok,
    status: result.status,
    body: result.bodyPreview,
  });
}

export function buildHttpApiFunctionTool(
  agentTool: AgentTool,
): Tool<AgentUserContext> | null {
  if (!agentTool.enabled || !isStoredHttpApiToolConfig(agentTool.config)) {
    return null;
  }

  const config = agentTool.config;

  return tool({
    name: agentTool.name,
    description:
      agentTool.description ??
      `Call the configured ${config.method} API endpoint.`,
    parameters: createJsonSchema(config),
    strict: true,
    timeoutMs: 15000,
    timeoutBehavior: "error_as_result",
    errorFunction: (_context, error) =>
      error instanceof Error
        ? `Tool ${agentTool.name} failed: ${error.message}`
        : `Tool ${agentTool.name} failed`,
    execute: async (parameters) => {
      const args = isRecord(parameters) ? parameters : {};
      const result = await executeHttpApiTool({
        config,
        parameters: args,
      });

      return formatToolResult(result);
    },
  });
}
