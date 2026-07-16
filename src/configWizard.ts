import * as p from "@clack/prompts";
import {
  loadConfig,
  writeConfig,
  MIN_CANDIDATES,
  MAX_CANDIDATES,
  type Config,
  type Provider,
} from "./lib/config.js";
import {
  getCredential,
  setCredential,
  type CredentialKey,
} from "./lib/credentials.js";
import {
  detectShell,
  installGhost,
  isGhostInstalled,
  uninstallGhost,
} from "./lib/installGhost.js";
import { listOllamaModels } from "./providers/ollama.js";

const PROVIDER_KEY_ENV: Partial<Record<Provider, CredentialKey>> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
};

export async function runConfigWizard(): Promise<void> {
  p.intro("commitghost config");

  const current = await loadConfig();

  const provider = await p.select({
    message: "Provider?",
    options: [
      { value: "ollama", label: "ollama (local, no API key)" },
      { value: "anthropic", label: "anthropic" },
      { value: "openai", label: "openai" },
    ],
    initialValue: current.provider,
  });
  if (p.isCancel(provider)) return cancelled();

  const keyEnvName = PROVIDER_KEY_ENV[provider as Provider];
  const existingKey = keyEnvName ? await getCredential(keyEnvName) : undefined;

  const apiKey = keyEnvName
    ? await p.password({
        message: existingKey
          ? `${keyEnvName} (already set — leave blank to keep it)`
          : `${keyEnvName} (leave blank to skip and set it later)`,
      })
    : "";
  if (p.isCancel(apiKey)) return cancelled();

  let model: string | symbol = current.model ?? "";
  if (provider === "ollama") {
    const spinner = p.spinner();
    spinner.start("Checking for local Ollama models");
    let installedModels: string[] = [];
    try {
      installedModels = await listOllamaModels();
      spinner.stop(
        installedModels.length
          ? `Found ${installedModels.length} local model(s)`
          : "No local models found",
      );
    } catch {
      spinner.stop("Could not reach Ollama — is it running?");
    }

    if (installedModels.length > 0) {
      model = await p.select({
        message: "Model?",
        options: [
          ...installedModels.map((m) => ({ value: m, label: m })),
          { value: "", label: "Other (type a model name)" },
        ],
        initialValue: installedModels.includes(current.model ?? "")
          ? current.model
          : installedModels[0],
      });
      if (p.isCancel(model)) return cancelled();
    }

    if (model === "") {
      model = await p.text({
        message: "Model name (e.g. llama3.1)",
        placeholder: current.model ?? "llama3.1",
        initialValue: current.model ?? "",
      });
      if (p.isCancel(model)) return cancelled();
    }
  } else {
    model = await p.text({
      message: "Model (leave blank for provider default)",
      placeholder: current.model ?? "(provider default)",
      initialValue: current.model ?? "",
    });
    if (p.isCancel(model)) return cancelled();
  }

  const style = await p.text({
    message:
      "Commit message style (leave blank for auto-detect from repo history)",
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

  const shell = detectShell();
  const ghostAlreadyInstalled = shell ? await isGhostInstalled(shell) : false;

  const wantsGhost = await p.confirm({
    message:
      "Add reminder ghost? Appears for diffs > threshold — completely optional and configurable.",
    initialValue: ghostAlreadyInstalled,
  });
  if (p.isCancel(wantsGhost)) return cancelled();

  let warnLines: string | symbol = String(current.warnLines);
  if (wantsGhost) {
    warnLines = await p.text({
      message:
        "Ghost warning threshold (lines changed before the prompt ghost appears)",
      initialValue: String(current.warnLines),
      validate: (v) => {
        const n = parseInt(v, 10);
        if (isNaN(n) || n < 1) return "Enter a positive number";
      },
    });
    if (p.isCancel(warnLines)) return cancelled();
  }

  const verbose = await p.confirm({
    message:
      "Always show verbose output (file stats, token usage, cost, timing)?",
    initialValue: current.verbose,
  });
  if (p.isCancel(verbose)) return cancelled();

  const next: Config = {
    provider: provider as Provider,
    model: (model as string | undefined)?.trim() || undefined,
    style: (style as string | undefined)?.trim() || undefined,
    candidateCount: parseInt(
      (candidateCount as string | undefined) ?? String(current.candidateCount),
      10,
    ),
    warnLines: parseInt(
      (warnLines as string | undefined) ?? String(current.warnLines),
      10,
    ),
    verbose: verbose as boolean,
  };

  const confirmed = await p.confirm({
    message: `Save to .commitghost.json?`,
  });
  if (p.isCancel(confirmed) || !confirmed) return cancelled();

  const target = await writeConfig(next);

  const trimmedKey = (apiKey as string).trim();
  const messages: string[] = [`Saved config to ${target}`];
  if (trimmedKey && keyEnvName) {
    const credPath = await setCredential(keyEnvName, trimmedKey);
    messages.push(`Saved ${keyEnvName} to ${credPath}`);
  }

  if (shell) {
    if (wantsGhost) {
      const result = await installGhost(shell);
      if (result.status === "installed") {
        messages.push(`Added the ghost hook to ${result.rcFile}`);
      }
    } else {
      const result = await uninstallGhost(shell);
      if (result.status === "removed") {
        messages.push(`Removed the ghost hook from ${result.rcFile}`);
      }
    }
  } else if (wantsGhost) {
    messages.push(
      `Could not detect your shell — run "commitghost install-ghost <zsh|bash>" to finish setup.`,
    );
  }

  p.outro(messages.join("\n"));
}

function cancelled() {
  p.cancel("Config unchanged.");
}
