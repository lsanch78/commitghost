import OpenAI from "openai";
import type { GenerateOptions, Provider } from "./types.js";
import { buildPrompt, parseCandidates } from "./prompt.js";

const DEFAULT_MODEL = "gpt-4o-mini";

export function createOpenAIProvider(): Provider {
  return {
    name: "openai",
    async generate(options: GenerateOptions): Promise<string[]> {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "OPENAI_API_KEY is not set. Export it or add it to your shell profile."
        );
      }

      const client = new OpenAI({ apiKey });
      const { system, user } = buildPrompt(options);

      const response = await client.chat.completions.create({
        model: options.model ?? DEFAULT_MODEL,
        max_tokens: 512,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });

      const text = response.choices[0]?.message?.content ?? "";
      return parseCandidates(text, options.candidateCount);
    },
  };
}
