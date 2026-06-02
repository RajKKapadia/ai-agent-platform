"use client";

import {
  createAgentAction,
  generateGuardrailAction,
  validateOpenAIKeyAction,
} from "@/app/actions/agents";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Bot,
  CheckCircle2,
  KeyRound,
  Loader2,
  Save,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

export function NewAgentForm() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [modelSearch, setModelSearch] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [guardrailEnabled, setGuardrailEnabled] = useState(true);
  const [guardrailPrompt, setGuardrailPrompt] = useState("");
  const [error, setError] = useState<string>();
  const [isValidating, startValidation] = useTransition();
  const [isGenerating, startGeneration] = useTransition();
  const [isSaving, startSaving] = useTransition();

  const filteredModels = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();

    if (!query) {
      return models.slice(0, 20);
    }

    return models
      .filter((model) => model.toLowerCase().includes(query))
      .slice(0, 20);
  }, [modelSearch, models]);

  function validateKey() {
    setError(undefined);
    startValidation(async () => {
      const result = await validateOpenAIKeyAction(apiKey);

      if (result.error) {
        setError(result.error);
        return;
      }

      const nextModels = result.data?.models ?? [];
      setModels(nextModels);
      setSelectedModel(nextModels[0] ?? "");
    });
  }

  function generateGuardrail() {
    setError(undefined);
    startGeneration(async () => {
      const result = await generateGuardrailAction({
        apiKey,
        model: selectedModel,
        agentPrompt: instructions,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setGuardrailPrompt(result.data?.guardrailPrompt ?? "");
    });
  }

  function saveAgent() {
    setError(undefined);
    startSaving(async () => {
      const result = await createAgentAction({
        name,
        apiKey,
        model: selectedModel,
        instructions,
        guardrailEnabled,
        guardrailPrompt,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      const agentId = result.data?.agentId;

      if (agentId) {
        router.push(`/agents/${agentId}`);
      }
    });
  }

  const canValidate = apiKey.trim().length > 0 && !isValidating;
  const canGenerate =
    apiKey.trim().length > 0 &&
    selectedModel.length > 0 &&
    instructions.trim().length >= 10 &&
    !isGenerating;
  const canSave =
    name.trim().length >= 2 &&
    apiKey.trim().length > 0 &&
    selectedModel.length > 0 &&
    instructions.trim().length >= 10 &&
    !isSaving;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        {error ? <Alert>{error}</Alert> : null}

        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound className="size-5 text-zinc-700" />
            <h2 className="text-base font-semibold text-zinc-950">
              OpenAI key
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API key</Label>
              <Input
                autoComplete="off"
                id="apiKey"
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="sk-..."
                type="password"
                value={apiKey}
              />
            </div>
            <Button
              className="self-end"
              disabled={!canValidate}
              onClick={validateKey}
              type="button"
            >
              {isValidating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Validate
            </Button>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Bot className="size-5 text-zinc-700" />
            <h2 className="text-base font-semibold text-zinc-950">Agent</h2>
          </div>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                onChange={(event) => setName(event.target.value)}
                placeholder="Support assistant"
                value={name}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modelSearch">Model</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 size-4 text-zinc-400" />
                <Input
                  className="pl-9"
                  disabled={models.length === 0}
                  id="modelSearch"
                  onChange={(event) => setModelSearch(event.target.value)}
                  placeholder={selectedModel || "Validate key first"}
                  value={modelSearch}
                />
              </div>
              <div className="max-h-56 overflow-y-auto rounded-md border border-zinc-200 bg-white">
                {filteredModels.length > 0 ? (
                  filteredModels.map((model) => (
                    <button
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-zinc-50",
                        selectedModel === model && "bg-zinc-100 font-medium",
                      )}
                      key={model}
                      onClick={() => {
                        setSelectedModel(model);
                        setModelSearch("");
                      }}
                      type="button"
                    >
                      <span>{model}</span>
                      {selectedModel === model ? (
                        <CheckCircle2 className="size-4 text-zinc-700" />
                      ) : null}
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-zinc-500">
                    No models found
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">Prompt</Label>
              <Textarea
                id="instructions"
                onChange={(event) => setInstructions(event.target.value)}
                placeholder="You are a focused assistant that..."
                rows={8}
                value={instructions}
              />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-zinc-700" />
              <h2 className="text-base font-semibold text-zinc-950">
                Guardrail
              </h2>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
              <input
                checked={guardrailEnabled}
                className="size-4 rounded border-zinc-300"
                onChange={(event) => setGuardrailEnabled(event.target.checked)}
                type="checkbox"
              />
              Enabled
            </label>
          </div>
          <div className="space-y-3">
            <Textarea
              disabled={!guardrailEnabled}
              onChange={(event) => setGuardrailPrompt(event.target.value)}
              placeholder="Guardrail prompt"
              rows={6}
              value={guardrailPrompt}
            />
            <Button
              disabled={!canGenerate || !guardrailEnabled}
              onClick={generateGuardrail}
              type="button"
              variant="outline"
            >
              {isGenerating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              Generate
            </Button>
          </div>
        </section>
      </div>

      <aside className="h-fit rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-zinc-950">
              {name || "Untitled agent"}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {selectedModel || "No model selected"}
            </p>
          </div>
          <div className="rounded-md border border-zinc-200 p-3 text-sm text-zinc-600">
            <p>Knowledge base: OpenAI vector store</p>
            <p>Tools: configurable</p>
            <p>MCP: configurable</p>
          </div>
          <Button className="w-full" disabled={!canSave} onClick={saveAgent}>
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save agent
          </Button>
        </div>
      </aside>
    </div>
  );
}
