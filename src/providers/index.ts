import type { Provider as ProviderName } from "../lib/config.js";
import type { Provider } from "./types.js";
import { createAnthropicProvider } from "./anthropic.js";
import { createOpenAIProvider } from "./openai.js";
import { createOllamaProvider } from "./ollama.js";

export function getProvider(name: ProviderName): Provider {
  switch (name) {
    case "anthropic":
      return createAnthropicProvider();
    case "openai":
      return createOpenAIProvider();
    case "ollama":
      return createOllamaProvider();
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}

export type { Provider, GenerateOptions } from "./types.js";
