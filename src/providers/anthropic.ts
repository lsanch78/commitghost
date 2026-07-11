import Anthropic from "@anthropic-ai/sdk";
import type { GenerateOptions, Provider } from "./types.js";
import { buildPrompt, parseCandidates } from "./prompt.js";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export function createAnthropicProvider(): Provider {
  return {
    name: "anthropic",
    async generate(options: GenerateOptions): Promise<string[]> {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error(
          "ANTHROPIC_API_KEY is not set. Export it or add it to your shell profile."
        );
      }

      const client = new Anthropic({ apiKey });
      const { system, user } = buildPrompt(options);

      const response = await client.messages.create({
        model: options.model ?? DEFAULT_MODEL,
        max_tokens: 512,
        system,
        messages: [{ role: "user", content: user }],
      });

      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => (block as { text: string }).text)
        .join("\n");

      return parseCandidates(text, options.candidateCount);
    },
  };
}
