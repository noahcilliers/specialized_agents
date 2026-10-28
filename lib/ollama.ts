import { Ollama } from "ollama";

/** Everything runs against a local Ollama server. No API keys involved. */

// OLLAMA_HOST is Ollama's own standard variable, so it's shared with the CLI.
// The app's other settings use a MODULAR_ prefix so that generic OLLAMA_* exports
// in a shell profile (meant for other tools) don't silently change this app.
export const OLLAMA_HOST = (process.env.OLLAMA_HOST || "http://127.0.0.1:11434").replace(/\/$/, "");

const DEFAULT_NUM_CTX = 16_384;
/** Context window to request. Ollama reserves memory for all of it up front (~147 KB per token for qwen3:8b). */
export const NUM_CTX = parseNumCtx(process.env.MODULAR_NUM_CTX);
export const KEEP_ALIVE = process.env.MODULAR_KEEP_ALIVE || "15m";
const MODEL_OVERRIDE = process.env.MODULAR_MODEL || null;

function parseNumCtx(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 2048 && n <= 262_144 ? n : DEFAULT_NUM_CTX;
}

/** Models that handle tool calling well, in order of preference, used to pick a default. */
const PREFERRED = ["qwen3", "gpt-oss", "llama3.1", "llama3.2", "qwen2.5", "mistral-nemo", "mistral"];

export interface LocalModel {
  name: string;
  sizeBytes: number;
  parameterSize: string;
  family: string;
  contextLength: number | null;
  tools: boolean;
  thinking: boolean;
}

export interface OllamaStatus {
  running: boolean;
  version: string | null;
  models: LocalModel[];
  defaultModel: string | null;
  error?: string;
}

/** A fresh client per request, so aborting one chat doesn't cancel another. */
export function ollamaClient(): Ollama {
  return new Ollama({ host: OLLAMA_HOST });
}

interface TagsResponse {
  models?: {
    name: string;
    size: number;
    details?: { family?: string; parameter_size?: string; context_length?: number };
    capabilities?: string[];
  }[];
}

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${OLLAMA_HOST}${path}`, { ...init, signal: AbortSignal.timeout(3000), cache: "no-store" });
  if (!res.ok) throw new Error(`Ollama ${path} returned ${res.status}`);
  return (await res.json()) as T;
}

async function capabilitiesFor(name: string): Promise<string[]> {
  // Older Ollama versions don't include capabilities in /api/tags.
  const show = await getJson<{ capabilities?: string[] }>("/api/show", {
    method: "POST",
    body: JSON.stringify({ model: name }),
  }).catch(() => ({ capabilities: [] as string[] }));
  return show.capabilities ?? [];
}

export async function getOllamaStatus(): Promise<OllamaStatus> {
  try {
    const [{ version }, tags] = await Promise.all([
      getJson<{ version: string }>("/api/version"),
      getJson<TagsResponse>("/api/tags"),
    ]);
    const models = await Promise.all(
      (tags.models ?? []).map(async (m): Promise<LocalModel> => {
        const caps = m.capabilities ?? (await capabilitiesFor(m.name));
        return {
          name: m.name,
          sizeBytes: m.size,
          parameterSize: m.details?.parameter_size ?? "",
          family: m.details?.family ?? "",
          contextLength: m.details?.context_length ?? null,
          tools: caps.includes("tools"),
          thinking: caps.includes("thinking"),
        };
      }),
    );
    models.sort((a, b) => a.name.localeCompare(b.name));
    return { running: true, version, models, defaultModel: pickDefaultModel(models) };
  } catch (err) {
    return {
      running: false,
      version: null,
      models: [],
      defaultModel: MODEL_OVERRIDE,
      error: (err as Error).message,
    };
  }
}

function pickDefaultModel(models: LocalModel[]): string | null {
  if (MODEL_OVERRIDE) return MODEL_OVERRIDE;
  const withTools = models.filter((m) => m.tools);
  for (const prefix of PREFERRED) {
    const match = withTools.find((m) => m.name.startsWith(prefix) && !m.name.includes("coder"));
    if (match) return match.name;
  }
  return withTools[0]?.name ?? models[0]?.name ?? null;
}

/** Find an installed model by name, treating "llama3.1" and "llama3.1:latest" as the same. */
export function findModel(models: LocalModel[], name: string): LocalModel | undefined {
  const norm = (n: string) => (n.includes(":") ? n : `${n}:latest`);
  return models.find((m) => norm(m.name) === norm(name));
}

/** The model an agent will actually use: its own choice, or the default. */
export function resolveModel(agentModel: string | null, status: OllamaStatus): string | null {
  return agentModel || status.defaultModel;
}
