import type { GenerateOptions, GenerateResult, Provider } from "./types.js";
import { buildPrompt, parseCandidates } from "./prompt.js";

const DEFAULT_MODEL = "llama3.1";
const DEFAULT_HOST = "http://localhost:11434";

interface OllamaChatResponse {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaTagsResponse {
  models?: { name: string }[];
}

export function getOllamaHost(): string {
  return (process.env.OLLAMA_HOST ?? DEFAULT_HOST).replace(/\/$/, "");
}

export async function listOllamaModels(
  host = getOllamaHost(),
): Promise<string[]> {
  const response = await fetch(`${host}/api/tags`);
  if (!response.ok) {
    throw new Error(`Could not list Ollama models (${response.status})`);
  }
  const data = (await response.json()) as OllamaTagsResponse;
  return (data.models ?? []).map((m) => m.name);
}

export function createOllamaProvider(): Provider {
  return {
    name: "ollama",
    async generate(options: GenerateOptions): Promise<GenerateResult> {
      const host = getOllamaHost();
      const { system, user } = buildPrompt(options);
      const model = options.model ?? DEFAULT_MODEL;

      let response: Response;
      try {
        response = await fetch(`${host}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            stream: false,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
          }),
        });
      } catch (err) {
        throw new Error(
          `Could not reach Ollama at ${host}. Is it running? Start it with \`ollama serve\`, or set OLLAMA_HOST.`,
        );
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(
          `Ollama request failed (${response.status}): ${body || response.statusText}`,
        );
      }

      const data = (await response.json()) as OllamaChatResponse;
      const text = data.message?.content ?? "";

      return {
        candidates: parseCandidates(text, options.candidateCount),
        usage: {
          inputTokens: data.prompt_eval_count ?? 0,
          outputTokens: data.eval_count ?? 0,
          model,
        },
      };
    },
  };
}
