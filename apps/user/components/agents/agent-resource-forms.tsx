"use client";

import {
  createMcpServerAction,
  createToolAction,
  createWhatsAppConnectionAction,
  uploadKnowledgeFileAction,
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
import type { ApiAgentConnection } from "@/lib/api-types";
import {
  Check,
  Copy,
  FileText,
  Loader2,
  MessageCircle,
  Plug,
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

export function ToolCreateForm({ agentId }: { agentId: string }) {
  const [state, formAction, isPending] = useActionState(
    createToolAction.bind(null, agentId),
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Alert>{state.error}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="toolName">Name</Label>
          <Input
            id="toolName"
            name="name"
            placeholder="lookup_order"
            required
          />
          {state.fieldErrors?.name?.[0] ? (
            <p className="text-sm text-red-600">{state.fieldErrors.name[0]}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="toolDescription">Description</Label>
          <Input
            id="toolDescription"
            name="description"
            placeholder="Fetch order details"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="toolConfig">Config</Label>
        <Textarea id="toolConfig" name="config" rows={4} defaultValue="{\n}" />
        {state.fieldErrors?.config?.[0] ? (
          <p className="text-sm text-red-600">{state.fieldErrors.config[0]}</p>
        ) : null}
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
          <Wrench className="size-4" />
        )}
        Add tool
      </Button>
    </form>
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
