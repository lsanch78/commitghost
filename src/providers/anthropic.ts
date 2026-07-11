import Anthropic from "@anthropic-ai/sdk";
import type { GenerateOptions, GenerateResult, Provider } from "./types.js";
import { buildPrompt, parseCandidates } from "./prompt.js";
import { getCredential } from "../lib/credentials.js";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export function createAnthropicProvider(): Provider {
  return {
    name: "anthropic",
    async generate(options: GenerateOptions): Promise<GenerateResult> {
      const apiKey = await getCredential("ANTHROPIC_API_KEY");
      if (!apiKey) {
        throw new Error(
          "No Anthropic API key found. Run `commitghost --config` to set one, or export ANTHROPIC_API_KEY."
        );
      }

      const client = new Anthropic({ apiKey });
      const { system, user } = buildPrompt(options);
      const model = options.model ?? DEFAULT_MODEL;

      const response = await client.messages.create({
        model,
        max_tokens: 512,
        system,
        messages: [{ role: "user", content: user }],
      });

      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => (block as { text: string }).text)
        .join("\n");

      return {
        candidates: parseCandidates(text, options.candidateCount),
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          model,
        },
      };
    },
  };
}
