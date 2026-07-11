import OpenAI from "openai";
import type { GenerateOptions, GenerateResult, Provider } from "./types.js";
import { buildPrompt, parseCandidates } from "./prompt.js";
import { getCredential } from "../lib/credentials.js";

const DEFAULT_MODEL = "gpt-4o-mini";

export function createOpenAIProvider(): Provider {
  return {
    name: "openai",
    async generate(options: GenerateOptions): Promise<GenerateResult> {
      const apiKey = await getCredential("OPENAI_API_KEY");
      if (!apiKey) {
        throw new Error(
          "No OpenAI API key found. Run `commitghost --config` to set one, or export OPENAI_API_KEY.",
        );
      }

      const client = new OpenAI({ apiKey });
      const { system, user } = buildPrompt(options);
      const model = options.model ?? DEFAULT_MODEL;

      const response = await client.chat.completions.create({
        model,
        max_tokens: 512,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });

      const text = response.choices[0]?.message?.content ?? "";

      return {
        candidates: parseCandidates(text, options.candidateCount),
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
          model,
        },
      };
    },
  };
}
