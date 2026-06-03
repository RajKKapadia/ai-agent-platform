"use client";

import {
  createMcpServerAction,
  createToolAction,
  deleteToolAction,
  createWhatsAppConnectionAction,
  testToolAction,
  uploadKnowledgeFileAction,
  updateToolAction,
  updateWhatsAppConnectionAction,
  type AgentActionResult,
} from "@/app/actions/agents";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  ApiAgentTool,
  ApiAgentConnection,
  CreateToolInput,
  HttpApiToolConfig,
  ToolParameterType,
  ToolTestResult,
} from "@/lib/api-types";
import {
  Check,
  Copy,
  FileText,
  Loader2,
  MessageCircle,
  Pencil,
  Plug,
  Play,
  Plus,
  Save,
  Trash2,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import {
  useActionState,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";

const initialState: AgentActionResult = {};
const connectionInitialState: AgentActionResult<{
  connection: ApiAgentConnection;
}> = {};

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function KnowledgeUploadForm({ agentId }: { agentId: string }) {
  const [state, setState] = useState<AgentActionResult>(initialState);
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function syncSelectedFile(file: File | null) {
    setSelectedFile(file);

    if (!file || !inputRef.current) {
      return;
    }

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    inputRef.current.files = dataTransfer.files;
  }

  function clearFile() {
    setSelectedFile(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await uploadKnowledgeFileAction(agentId, state, formData);
      setState(result);

      if (result.success) {
        clearFile();
      }
    });
  }

  return (
    <form className="space-y-3" onSubmit={submitUpload}>
      {state.error ? <Alert>{state.error}</Alert> : null}
      <button
        className={cn(
          "flex min-h-44 w-full flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center transition-colors hover:border-zinc-400 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2",
          isDragging && "border-zinc-950 bg-white",
        )}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          syncSelectedFile(event.dataTransfer.files.item(0));
        }}
        type="button"
      >
        <Upload className="mb-3 size-8 text-zinc-600" />
        <span className="text-sm font-medium text-zinc-950">
          Drop a file here or choose from your computer
        </span>
        <span className="mt-1 text-sm text-zinc-500">
          One file is uploaded to the agent vector store.
        </span>
      </button>
      <Input
        className="sr-only"
        id="knowledgeFile"
        name="file"
        onChange={(event) =>
          syncSelectedFile(event.currentTarget.files?.item(0) ?? null)
        }
        ref={inputRef}
        required
        type="file"
      />
      {selectedFile ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white p-3">
          <div className="flex min-w-0 items-center gap-3">
            <FileText className="size-5 shrink-0 text-zinc-600" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-950">
                {selectedFile.name}
              </p>
              <p className="text-sm text-zinc-500">
                {formatBytes(selectedFile.size)}
              </p>
            </div>
          </div>
          <Button
            disabled={isPending}
            onClick={clearFile}
            size="sm"
            type="button"
            variant="outline"
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : null}
      <Button disabled={isPending || !selectedFile} type="submit">
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
        Upload
      </Button>
    </form>
  );
}

export function CopyValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex min-w-0 items-center gap-2 rounded-md border border-zinc-200 bg-white p-2">
        <p className="min-w-0 flex-1 truncate text-sm text-zinc-700">
          {value}
        </p>
        <Button
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

export function WhatsAppConnectionCreateForm({
  agentId,
}: {
  agentId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    createWhatsAppConnectionAction.bind(null, agentId),
    connectionInitialState,
  );
  const connection = state.data?.connection;

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert>{state.error}</Alert> : null}
      {connection ? (
        <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-900">
            WhatsApp connection created
          </p>
          <CopyValue label="Webhook URL" value={connection.webhookUrl} />
          <CopyValue
            label="Verification token"
            value={connection.verificationToken}
          />
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="whatsappConnectionName">Name</Label>
          <Input
            id="whatsappConnectionName"
            name="name"
            placeholder="Sales WhatsApp"
            required
          />
          {state.fieldErrors?.name?.[0] ? (
            <p className="text-sm text-red-600">{state.fieldErrors.name[0]}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="whatsappPhoneNumberId">Phone number id</Label>
          <Input
            id="whatsappPhoneNumberId"
            name="phoneNumberId"
            placeholder="1234567890"
            required
          />
          {state.fieldErrors?.phoneNumberId?.[0] ? (
            <p className="text-sm text-red-600">
              {state.fieldErrors.phoneNumberId[0]}
            </p>
          ) : null}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="whatsappAppId">App id</Label>
          <Input id="whatsappAppId" name="appId" required />
          {state.fieldErrors?.appId?.[0] ? (
            <p className="text-sm text-red-600">
              {state.fieldErrors.appId[0]}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="whatsappAccessToken">Access token</Label>
          <Input
            id="whatsappAccessToken"
            name="accessToken"
            required
            type="password"
          />
          {state.fieldErrors?.accessToken?.[0] ? (
            <p className="text-sm text-red-600">
              {state.fieldErrors.accessToken[0]}
            </p>
          ) : null}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="whatsappAppSecret">App secret</Label>
        <Input
          id="whatsappAppSecret"
          name="appSecret"
          required
          type="password"
        />
        {state.fieldErrors?.appSecret?.[0] ? (
          <p className="text-sm text-red-600">
            {state.fieldErrors.appSecret[0]}
          </p>
        ) : null}
      </div>
      <Button disabled={isPending} type="submit">
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <MessageCircle className="size-4" />
        )}
        Connect WhatsApp
      </Button>
    </form>
  );
}

export function WhatsAppConnectionEditForm({
  agentId,
  connection,
  onCancel,
}: {
  agentId: string;
  connection: ApiAgentConnection;
  onCancel: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    updateWhatsAppConnectionAction.bind(null, agentId, connection.id),
    connectionInitialState,
  );

  return (
    <form action={formAction} className="space-y-4 rounded-md border border-zinc-200 bg-zinc-50 p-4">
      {state.error ? <Alert>{state.error}</Alert> : null}
      {state.success ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Connection updated
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`whatsappConnectionName-${connection.id}`}>
            Name
          </Label>
          <Input
            defaultValue={connection.name}
            id={`whatsappConnectionName-${connection.id}`}
            name="name"
            required
          />
          {state.fieldErrors?.name?.[0] ? (
            <p className="text-sm text-red-600">{state.fieldErrors.name[0]}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`whatsappPhoneNumberId-${connection.id}`}>
            Phone number id
          </Label>
          <Input
            defaultValue={connection.externalId}
            id={`whatsappPhoneNumberId-${connection.id}`}
            name="phoneNumberId"
            required
          />
          {state.fieldErrors?.phoneNumberId?.[0] ? (
            <p className="text-sm text-red-600">
              {state.fieldErrors.phoneNumberId[0]}
            </p>
          ) : null}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`whatsappAppId-${connection.id}`}>App id</Label>
          <Input
            defaultValue={connection.appId}
            id={`whatsappAppId-${connection.id}`}
            name="appId"
            required
          />
          {state.fieldErrors?.appId?.[0] ? (
            <p className="text-sm text-red-600">
              {state.fieldErrors.appId[0]}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`whatsappAccessToken-${connection.id}`}>
            Access token
          </Label>
          <Input
            id={`whatsappAccessToken-${connection.id}`}
            name="accessToken"
            placeholder={`Leave blank to keep ****${connection.accessTokenLastFour}`}
            type="password"
          />
          {state.fieldErrors?.accessToken?.[0] ? (
            <p className="text-sm text-red-600">
              {state.fieldErrors.accessToken[0]}
            </p>
          ) : null}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`whatsappAppSecret-${connection.id}`}>App secret</Label>
        <Input
          id={`whatsappAppSecret-${connection.id}`}
          name="appSecret"
          placeholder="Leave blank to keep current app secret"
          type="password"
        />
        {state.fieldErrors?.appSecret?.[0] ? (
          <p className="text-sm text-red-600">
            {state.fieldErrors.appSecret[0]}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={isPending} type="submit">
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MessageCircle className="size-4" />
          )}
          Save connection
        </Button>
        <Button
          disabled={isPending}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

const parameterTypes: ToolParameterType[] = [
  "string",
  "number",
  "boolean",
  "object",
  "array",
];

interface EditableParameter {
  id: string;
  name: string;
  type: ToolParameterType;
  description: string;
  required: boolean;
}

interface EditableHeader {
  id: string;
  name: string;
  value: string;
  valuePreview?: string;
}

function createRowId() {
  return Math.random().toString(36).slice(2);
}

function emptyParameter(): EditableParameter {
  return {
    id: createRowId(),
    name: "",
    type: "string",
    description: "",
    required: true,
  };
}

function emptyHeader(): EditableHeader {
  return {
    id: createRowId(),
    name: "",
    value: "",
  };
}

function isHttpToolConfig(
  config: ApiAgentTool["config"] | undefined,
): config is HttpApiToolConfig {
  return Boolean(
    config &&
      config.type === "http_api" &&
      (config.method === "GET" || config.method === "POST") &&
      typeof config.url === "string" &&
      Array.isArray(config.parameters) &&
      Array.isArray(config.headers),
  );
}

function getInitialToolState(tool?: ApiAgentTool) {
  const config = isHttpToolConfig(tool?.config) ? tool.config : undefined;

  return {
    name: tool?.name ?? "",
    description: tool?.description ?? "",
    enabled: tool?.enabled ?? true,
    method: config?.method ?? "GET",
    url: config?.url ?? "",
    parameters:
      config?.parameters.map((parameter) => ({
        id: createRowId(),
        ...parameter,
      })) ?? [],
    headers:
      config?.headers.map((header) => ({
        id: createRowId(),
        name: header.name,
        value: "",
        valuePreview: header.valuePreview,
      })) ?? [],
  };
}

function fieldErrorText(fieldErrors?: Record<string, string[] | undefined>) {
  return (
    Object.values(fieldErrors ?? {})
      .flat()
      .filter(Boolean)
      .join(", ") || undefined
  );
}

function formatTestParameters(parameters: EditableParameter[]) {
  return parameters.filter((parameter) => parameter.name.trim().length > 0);
}

function buildToolInput(input: {
  name: string;
  description: string;
  enabled: boolean;
  method: "GET" | "POST";
  url: string;
  parameters: EditableParameter[];
  headers: EditableHeader[];
}): CreateToolInput {
  return {
    name: input.name,
    description: input.description || undefined,
    enabled: input.enabled,
    config: {
      type: "http_api",
      method: input.method,
      url: input.url,
      parameters: formatTestParameters(input.parameters).map((parameter) => ({
        name: parameter.name,
        type: parameter.type,
        description: parameter.description,
        required: parameter.required,
      })),
      headers: input.headers
        .filter((header) => header.name.trim().length > 0)
        .map((header) => ({
          name: header.name,
          value: header.value || undefined,
          valuePreview: header.valuePreview,
        })),
    },
  };
}

function ToolEditorForm({
  agentId,
  onCancel,
  onSaved,
  tool,
}: {
  agentId: string;
  onCancel?: () => void;
  onSaved: () => void;
  tool?: ApiAgentTool;
}) {
  const initialToolState = getInitialToolState(tool);
  const [name, setName] = useState(initialToolState.name);
  const [description, setDescription] = useState(
    initialToolState.description,
  );
  const [enabled, setEnabled] = useState(initialToolState.enabled);
  const [method, setMethod] = useState<"GET" | "POST">(
    initialToolState.method,
  );
  const [url, setUrl] = useState(initialToolState.url);
  const [parameters, setParameters] = useState<EditableParameter[]>(
    initialToolState.parameters,
  );
  const [headers, setHeaders] = useState<EditableHeader[]>(
    initialToolState.headers,
  );
  const [testValues, setTestValues] = useState<Record<string, string>>({});
  const [state, setState] = useState<AgentActionResult<unknown>>(initialState);
  const [testResult, setTestResult] = useState<ToolTestResult>();
  const [isSaving, startSaving] = useTransition();
  const [isTesting, startTesting] = useTransition();
  const toolInput = buildToolInput({
    name,
    description,
    enabled,
    method,
    url,
    parameters,
    headers,
  });

  function updateParameter(
    id: string,
    patch: Partial<Omit<EditableParameter, "id">>,
  ) {
    setParameters((current) =>
      current.map((parameter) =>
        parameter.id === id ? { ...parameter, ...patch } : parameter,
      ),
    );
  }

  function updateHeader(id: string, patch: Partial<Omit<EditableHeader, "id">>) {
    setHeaders((current) =>
      current.map((header) =>
        header.id === id ? { ...header, ...patch } : header,
      ),
    );
  }

  function resetCreateForm() {
    const emptyState = getInitialToolState();

    setName(emptyState.name);
    setDescription(emptyState.description);
    setEnabled(emptyState.enabled);
    setMethod(emptyState.method);
    setUrl(emptyState.url);
    setParameters(emptyState.parameters);
    setHeaders(emptyState.headers);
    setTestValues({});
    setTestResult(undefined);
  }

  function saveTool() {
    setState(initialState);
    setTestResult(undefined);
    startSaving(async () => {
      const result = tool
        ? await updateToolAction(agentId, tool.id, toolInput)
        : await createToolAction(agentId, toolInput);

      setState(result);

      if (result.success) {
        if (!tool) {
          resetCreateForm();
        }

        onSaved();
      }
    });
  }

  function testTool() {
    setState(initialState);
    setTestResult(undefined);
    startTesting(async () => {
      const activeParameters = formatTestParameters(parameters);
      const result = await testToolAction(agentId, {
        toolId: tool?.id,
        config: toolInput.config,
        parameters: Object.fromEntries(
          activeParameters.map((parameter) => [
            parameter.name,
            testValues[parameter.name] ?? "",
          ]),
        ),
      });

      if (result.error || result.fieldErrors) {
        setState(result);
        return;
      }

      setTestResult(result.data?.result);
    });
  }

  const error = state.error ?? fieldErrorText(state.fieldErrors);
  const activeParameters = formatTestParameters(parameters);

  return (
    <div className="space-y-4 rounded-md border border-zinc-200 bg-zinc-50 p-4">
      {error ? <Alert>{error}</Alert> : null}
      {state.success ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Tool saved
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`toolName-${tool?.id ?? "new"}`}>Name</Label>
          <Input
            id={`toolName-${tool?.id ?? "new"}`}
            onChange={(event) => setName(event.target.value)}
            placeholder="lookup_order"
            value={name}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`toolDescription-${tool?.id ?? "new"}`}>
            Description
          </Label>
          <Input
            id={`toolDescription-${tool?.id ?? "new"}`}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Fetch order details"
            value={description}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
        <div className="space-y-2">
          <Label htmlFor={`toolMethod-${tool?.id ?? "new"}`}>Method</Label>
          <Select
            id={`toolMethod-${tool?.id ?? "new"}`}
            onChange={(event) => setMethod(event.target.value as "GET" | "POST")}
            value={method}
          >
            <option value="POST">POST</option>
            <option value="GET">GET</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`toolUrl-${tool?.id ?? "new"}`}>Endpoint URL</Label>
          <Input
            id={`toolUrl-${tool?.id ?? "new"}`}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://api.example.com/lookup"
            value={url}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
        <input
          checked={enabled}
          className="size-4 rounded border-zinc-300"
          onChange={(event) => setEnabled(event.target.checked)}
          type="checkbox"
        />
        Enabled
      </label>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label>Parameters</Label>
          <Button
            onClick={() =>
              setParameters((current) => [...current, emptyParameter()])
            }
            size="sm"
            type="button"
            variant="outline"
          >
            <Plus className="size-4" />
            Parameter
          </Button>
        </div>
        <div className="space-y-2">
          {parameters.length > 0 ? (
            parameters.map((parameter) => (
              <div
                className="grid gap-2 rounded-md border border-zinc-200 bg-white p-3 lg:grid-cols-[minmax(120px,1fr)_130px_minmax(160px,2fr)_90px_auto]"
                key={parameter.id}
              >
                <Input
                  onChange={(event) =>
                    updateParameter(parameter.id, {
                      name: event.target.value,
                    })
                  }
                  placeholder="customer_id"
                  value={parameter.name}
                />
                <Select
                  onChange={(event) =>
                    updateParameter(parameter.id, {
                      type: event.target.value as ToolParameterType,
                    })
                  }
                  value={parameter.type}
                >
                  {parameterTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
                <Input
                  onChange={(event) =>
                    updateParameter(parameter.id, {
                      description: event.target.value,
                    })
                  }
                  placeholder="Customer identifier"
                  value={parameter.description}
                />
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    checked={parameter.required}
                    className="size-4 rounded border-zinc-300"
                    onChange={(event) =>
                      updateParameter(parameter.id, {
                        required: event.target.checked,
                      })
                    }
                    type="checkbox"
                  />
                  Required
                </label>
                <Button
                  onClick={() =>
                    setParameters((current) =>
                      current.filter((item) => item.id !== parameter.id),
                    )
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))
          ) : (
            <p className="rounded-md border border-zinc-200 bg-white p-3 text-sm text-zinc-500">
              No parameters
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label>Headers</Label>
          <Button
            onClick={() => setHeaders((current) => [...current, emptyHeader()])}
            size="sm"
            type="button"
            variant="outline"
          >
            <Plus className="size-4" />
            Header
          </Button>
        </div>
        <div className="space-y-2">
          {headers.length > 0 ? (
            headers.map((header) => (
              <div
                className="grid gap-2 rounded-md border border-zinc-200 bg-white p-3 sm:grid-cols-[minmax(130px,1fr)_minmax(180px,1fr)_auto]"
                key={header.id}
              >
                <Input
                  onChange={(event) =>
                    updateHeader(header.id, { name: event.target.value })
                  }
                  placeholder="X-API-Key"
                  value={header.name}
                />
                <Input
                  onChange={(event) =>
                    updateHeader(header.id, { value: event.target.value })
                  }
                  placeholder={
                    header.valuePreview
                      ? `Leave blank to keep ${header.valuePreview}`
                      : "Header value"
                  }
                  type="password"
                  value={header.value}
                />
                <Button
                  onClick={() =>
                    setHeaders((current) =>
                      current.filter((item) => item.id !== header.id),
                    )
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))
          ) : (
            <p className="rounded-md border border-zinc-200 bg-white p-3 text-sm text-zinc-500">
              No custom headers
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3 rounded-md border border-zinc-200 bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <Label>Test values</Label>
          <Button
            disabled={isTesting}
            onClick={testTool}
            size="sm"
            type="button"
            variant="outline"
          >
            {isTesting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            Test
          </Button>
        </div>
        {activeParameters.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {activeParameters.map((parameter) => (
              <div className="space-y-2" key={parameter.id}>
                <Label>{parameter.name}</Label>
                {parameter.type === "object" || parameter.type === "array" ? (
                  <Textarea
                    onChange={(event) =>
                      setTestValues((current) => ({
                        ...current,
                        [parameter.name]: event.target.value,
                      }))
                    }
                    placeholder={parameter.type === "array" ? "[]" : "{}"}
                    rows={3}
                    value={testValues[parameter.name] ?? ""}
                  />
                ) : parameter.type === "boolean" ? (
                  <Select
                    onChange={(event) =>
                      setTestValues((current) => ({
                        ...current,
                        [parameter.name]: event.target.value,
                      }))
                    }
                    value={testValues[parameter.name] ?? ""}
                  >
                    <option value="">Empty</option>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </Select>
                ) : (
                  <Input
                    onChange={(event) =>
                      setTestValues((current) => ({
                        ...current,
                        [parameter.name]: event.target.value,
                      }))
                    }
                    type={parameter.type === "number" ? "number" : "text"}
                    value={testValues[parameter.name] ?? ""}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No parameters to fill.</p>
        )}
        {testResult ? (
          <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-sm font-medium text-zinc-950">
              {testResult.ok ? "Success" : "Failed"} · HTTP {testResult.status}
            </p>
            {!testResult.ok ? (
              <p className="text-sm text-zinc-600">
                The endpoint returned an error for {method} {url || "this URL"}.
                Check the HTTP method, URL, required parameters, and headers.
              </p>
            ) : null}
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-white p-3 text-xs text-zinc-700">
              {testResult.bodyPreview || "No response body"}
            </pre>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button disabled={isSaving} onClick={saveTool} type="button">
          {isSaving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : tool ? (
            <Save className="size-4" />
          ) : (
            <Wrench className="size-4" />
          )}
          {tool ? "Save tool" : "Add tool"}
        </Button>
        {onCancel ? (
          <Button
            disabled={isSaving}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function ToolManager({
  agentId,
  tools,
}: {
  agentId: string;
  tools: ApiAgentTool[];
}) {
  const router = useRouter();
  const [editingToolId, setEditingToolId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiAgentTool | null>(null);
  const [deleteState, setDeleteState] =
    useState<AgentActionResult>(initialState);
  const [isDeleting, startDeleting] = useTransition();

  function deleteTool() {
    if (!deleteTarget) {
      return;
    }

    setDeleteState(initialState);
    startDeleting(async () => {
      const result = await deleteToolAction(agentId, deleteTarget.id);
      setDeleteState(result);

      if (result.success) {
        setDeleteTarget(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <ToolEditorForm
        agentId={agentId}
        onSaved={() => {
          setEditingToolId(null);
          router.refresh();
        }}
      />
      <div className="divide-y divide-zinc-200 rounded-md border border-zinc-200">
        {tools.length > 0 ? (
          tools.map((tool) => {
            const config = isHttpToolConfig(tool.config) ? tool.config : null;

            return (
              <div className="p-3" key={tool.id}>
                {editingToolId === tool.id ? (
                  <ToolEditorForm
                    agentId={agentId}
                    onCancel={() => setEditingToolId(null)}
                    onSaved={() => {
                      setEditingToolId(null);
                      router.refresh();
                    }}
                    tool={tool}
                  />
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-950">
                        {tool.name}
                      </p>
                      <p className="mt-1 truncate text-sm text-zinc-500">
                        {config
                          ? `${config.method} ${config.url}`
                          : "Unconfigured tool"}
                      </p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {tool.enabled ? "enabled" : "disabled"}
                        {tool.description ? ` · ${tool.description}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        onClick={() => setEditingToolId(tool.id)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        onClick={() => {
                          setDeleteState(initialState);
                          setDeleteTarget(tool);
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <p className="p-3 text-sm text-zinc-500">No tools</p>
        )}
      </div>
      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-5 shadow-lg">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-md bg-red-50 p-2 text-red-600">
                <Trash2 className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-zinc-950">
                  Delete {deleteTarget.name}
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  This will remove the tool from the agent. The agent will no
                  longer be able to call this endpoint.
                </p>
              </div>
            </div>
            {deleteState.error ? <Alert>{deleteState.error}</Alert> : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={isDeleting}
                onClick={deleteTool}
                type="button"
                variant="destructive"
              >
                {isDeleting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Delete tool
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function McpServerCreateForm({ agentId }: { agentId: string }) {
  const [state, formAction, isPending] = useActionState(
    createMcpServerAction.bind(null, agentId),
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Alert>{state.error}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="mcpName">Name</Label>
          <Input id="mcpName" name="name" placeholder="deepwiki" required />
          {state.fieldErrors?.name?.[0] ? (
            <p className="text-sm text-red-600">{state.fieldErrors.name[0]}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="mcpTransport">Transport</Label>
          <Select defaultValue="hosted" id="mcpTransport" name="transport">
            <option value="hosted">Hosted</option>
            <option value="streamable_http">Streamable HTTP</option>
            <option value="stdio">Stdio</option>
          </Select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="mcpServerUrl">Server URL</Label>
          <Input
            id="mcpServerUrl"
            name="serverUrl"
            placeholder="https://example.com/mcp"
          />
          {state.fieldErrors?.serverUrl?.[0] ? (
            <p className="text-sm text-red-600">
              {state.fieldErrors.serverUrl[0]}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="mcpCommand">Command</Label>
          <Input id="mcpCommand" name="command" placeholder="npx server" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="mcpApproval">Approval</Label>
          <Select defaultValue="never" id="mcpApproval" name="requireApproval">
            <option value="never">Never</option>
            <option value="always">Always</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="mcpToolFilter">Tool filter</Label>
          <Input id="mcpToolFilter" name="toolFilter" placeholder="{}" />
          {state.fieldErrors?.toolFilter?.[0] ? (
            <p className="text-sm text-red-600">
              {state.fieldErrors.toolFilter[0]}
            </p>
          ) : null}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
        <input
          className="size-4 rounded border-zinc-300"
          defaultChecked
          name="enabled"
          type="checkbox"
        />
        Enabled
      </label>
      <Button disabled={isPending} type="submit">
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Plug className="size-4" />
        )}
        Add MCP
      </Button>
    </form>
  );
}
