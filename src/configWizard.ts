import * as p from "@clack/prompts";
import {
  loadConfig,
  writeConfig,
  MIN_CANDIDATES,
  MAX_CANDIDATES,
  type Config,
  type Provider,
} from "./lib/config.js";
import { getCredential, setCredential, type CredentialKey } from "./lib/credentials.js";

const PROVIDER_KEY_ENV: Record<Provider, CredentialKey> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
};

export async function runConfigWizard(): Promise<void> {
  p.intro("commitghost config");

  const current = await loadConfig();

  const provider = await p.select({
    message: "Provider?",
    options: [
      { value: "anthropic", label: "anthropic" },
      { value: "openai", label: "openai" },
    ],
    initialValue: current.provider,
  });
  if (p.isCancel(provider)) return cancelled();

  const keyEnvName = PROVIDER_KEY_ENV[provider as Provider];
  const existingKey = await getCredential(keyEnvName);

  const apiKey = await p.password({
    message: existingKey
      ? `${keyEnvName} (already set — leave blank to keep it)`
      : `${keyEnvName} (leave blank to skip and set it later)`,
  });
  if (p.isCancel(apiKey)) return cancelled();

  const model = await p.text({
    message: "Model (leave blank for provider default)",
    placeholder: current.model ?? "(provider default)",
    initialValue: current.model ?? "",
  });
  if (p.isCancel(model)) return cancelled();

  const style = await p.text({
    message: "Commit message style (leave blank for auto-detect from repo history)",
    placeholder: current.style ?? "(auto)",
    initialValue: current.style ?? "",
  });
  if (p.isCancel(style)) return cancelled();

  const candidateCount = await p.text({
    message: `Number of candidates to generate (${MIN_CANDIDATES}-${MAX_CANDIDATES})`,
    initialValue: String(current.candidateCount),
    validate: (v) => {
      const n = parseInt(v, 10);
      if (isNaN(n) || n < MIN_CANDIDATES || n > MAX_CANDIDATES) {
        return `Enter a number between ${MIN_CANDIDATES} and ${MAX_CANDIDATES}`;
      }
    },
  });
  if (p.isCancel(candidateCount)) return cancelled();

  const warnLines = await p.text({
    message: "Ghost warning threshold (lines changed before the prompt ghost appears)",
    initialValue: String(current.warnLines),
    validate: (v) => {
      const n = parseInt(v, 10);
      if (isNaN(n) || n < 1) return "Enter a positive number";
    },
  });
  if (p.isCancel(warnLines)) return cancelled();

  const verbose = await p.confirm({
    message: "Always show verbose output (file stats, token usage, cost, timing)?",
    initialValue: current.verbose,
  });
  if (p.isCancel(verbose)) return cancelled();

  const next: Config = {
    provider: provider as Provider,
    model: (model as string).trim() || undefined,
    style: (style as string).trim() || undefined,
    candidateCount: parseInt(candidateCount as string, 10),
    warnLines: parseInt(warnLines as string, 10),
    verbose: verbose as boolean,
  };

  const confirmed = await p.confirm({
    message: `Save to .commitghost.json?`,
  });
  if (p.isCancel(confirmed) || !confirmed) return cancelled();

  const target = await writeConfig(next);

  const trimmedKey = (apiKey as string).trim();
  if (trimmedKey) {
    const credPath = await setCredential(keyEnvName, trimmedKey);
    p.outro(`Saved config to ${target}\nSaved ${keyEnvName} to ${credPath}`);
  } else {
    p.outro(`Saved to ${target}`);
  }
}

function cancelled() {
  p.cancel("Config unchanged.");
}
