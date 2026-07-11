#!/usr/bin/env node
import { Command, InvalidArgumentError } from "commander";
import * as p from "@clack/prompts";
import { getStagedDiffContext, commit } from "./lib/git.js";
import { truncateDiff } from "./lib/diff.js";
import { loadConfig, MIN_CANDIDATES, MAX_CANDIDATES } from "./lib/config.js";
import { getProvider } from "./providers/index.js";
import { getWorkingTreeLinesChanged } from "./lib/diffSize.js";
import { getWarnLinesSync } from "./lib/configSync.js";
import { GHOST } from "./lib/ghost.js";
import { ZSH_INIT, BASH_INIT } from "./lib/shellInit.js";
import { runConfigWizard } from "./configWizard.js";
import { estimateCost, formatCost } from "./lib/pricing.js";
import {
  detectShell,
  installGhost,
  uninstallGhost,
  type SupportedShell,
} from "./lib/installGhost.js";

const REGENERATE = "__commitghost_regenerate__";
const EDIT = "__commitghost_edit__";
const CANCEL = "__commitghost_cancel__";

async function pickMessage(
  candidates: string[],
): Promise<string | typeof REGENERATE | typeof CANCEL> {
  const choice = await p.select({
    message: "Pick a commit message",
    options: [
      ...candidates.map((c) => ({ value: c, label: c })),
      { value: EDIT, label: "✎  Edit a candidate" },
      { value: REGENERATE, label: "↻  Regenerate" },
      { value: CANCEL, label: "✕  Cancel" },
    ],
  });

  if (p.isCancel(choice) || choice === CANCEL) return CANCEL;
  if (choice === REGENERATE) return REGENERATE;

  if (choice === EDIT) {
    const editTarget = await p.select({
      message: "Which candidate do you want to edit?",
      options: candidates.map((c) => ({ value: c, label: c })),
    });
    if (p.isCancel(editTarget)) return CANCEL;

    const edited = await p.text({
      message: "Edit commit message",
      initialValue: editTarget as string,
    });
    if (p.isCancel(edited)) return CANCEL;
    return edited as string;
  }

  return choice;
}

function ghostCheck() {
  const warnLines = getWarnLinesSync();
  const linesChanged = getWorkingTreeLinesChanged();
  if (linesChanged > warnLines) {
    process.stdout.write(GHOST);
  }
}

function shellInit(shell: string) {
  if (shell === "zsh") {
    process.stdout.write(ZSH_INIT);
  } else if (shell === "bash") {
    process.stdout.write(BASH_INIT);
  } else {
    console.error(`Unsupported shell: ${shell}. Use "zsh" or "bash".`);
    process.exit(1);
  }
}

function resolveShell(
  shellArg: string | undefined,
  commandName: string,
): SupportedShell {
  const shell = (shellArg as SupportedShell | undefined) ?? detectShell();

  if (!shell) {
    console.error(
      `Could not detect your shell from $SHELL. Run "commitghost ${commandName} zsh" or "commitghost ${commandName} bash" explicitly.`,
    );
    process.exit(1);
  }
  if (shell !== "zsh" && shell !== "bash") {
    console.error(`Unsupported shell: ${shell}. Use "zsh" or "bash".`);
    process.exit(1);
  }

  return shell;
}

async function runInstallGhost(shellArg?: string) {
  const shell = resolveShell(shellArg, "install-ghost");
  const result = await installGhost(shell);

  if (result.status === "already-installed") {
    console.log(`Already installed in ${result.rcFile}. Nothing to do.`);
    return;
  }

  console.log(`Added the ghost hook to ${result.rcFile}.`);
  console.log(
    `Run "source ${result.rcFile}" or open a new terminal to activate it.`,
  );
}

async function runUninstallGhost(shellArg?: string) {
  const shell = resolveShell(shellArg, "uninstall-ghost");
  const result = await uninstallGhost(shell);

  if (result.status === "not-installed") {
    console.log(`No ghost hook found in ${result.rcFile}. Nothing to do.`);
    return;
  }

  console.log(`Removed the ghost hook from ${result.rcFile}.`);
  console.log(
    `Run "source ${result.rcFile}" or open a new terminal to fully clear it.`,
  );
}

async function generateAndCommit(opts: any) {
  if (opts.config) {
    await runConfigWizard();
    return;
  }

  p.intro("commitghost");

  const config = await loadConfig();
  if (opts.provider) config.provider = opts.provider;
  if (opts.count) config.candidateCount = opts.count;
  const verbose: boolean =
    opts.verbose !== undefined ? opts.verbose : config.verbose;

  const spinner = p.spinner();

  try {
    const diffStart = Date.now();
    spinner.start("Reading staged diff");
    const { diff, filesChanged, fileStats, recentSubjects } =
      await getStagedDiffContext();
    const { diff: safeDiff, truncated } = truncateDiff(diff);
    const diffMs = Date.now() - diffStart;
    spinner.stop(
      `Read diff across ${filesChanged.length} file(s)${truncated ? " (truncated for length)" : ""}`,
    );

    if (verbose) {
      const lines = fileStats.map(
        (f) => `  ${f.file}  +${f.insertions} -${f.deletions}`,
      );
      p.log.info(`Files changed:\n${lines.join("\n")}`);
      p.log.info(
        `Diff read in ${diffMs}ms${truncated ? " (truncated for size)" : ""}`,
      );
    }

    const provider = getProvider(config.provider);

    let candidates: string[] = [];
    let result: string | typeof REGENERATE | typeof CANCEL;

    do {
      spinner.start(`Asking ${provider.name} for commit message candidates`);
      const apiStart = Date.now();
      const generated = await provider.generate({
        diff: safeDiff,
        filesChanged,
        recentSubjects,
        style: config.style,
        candidateCount: config.candidateCount,
        model: opts.model ?? config.model,
      });
      const apiMs = Date.now() - apiStart;
      candidates = generated.candidates;
      spinner.stop("Got candidates");

      if (verbose) {
        const { inputTokens, outputTokens, model } = generated.usage;
        const cost = estimateCost(model, inputTokens, outputTokens);
        p.log.info(
          `Model: ${model}\n` +
            `Tokens: ${inputTokens} in / ${outputTokens} out\n` +
            `Cost: ${cost !== undefined ? formatCost(cost) : "unknown (no pricing data for this model)"}\n` +
            `API call: ${apiMs}ms`,
        );
      }

      if (candidates.length === 0) {
        p.cancel("No candidates returned. Try again or check your diff.");
        process.exit(1);
      }

      result = await pickMessage(candidates);
    } while (result === REGENERATE);

    if (result === CANCEL) {
      p.cancel("Cancelled. No commit made.");
      process.exit(0);
    }

    const message = result as string;

    if (opts.dryRun) {
      p.outro(`Dry run — would commit with:\n\n${message}`);
      return;
    }

    spinner.start("Committing");
    await commit(message);
    spinner.stop("Committed");
    p.outro(message);
  } catch (err: any) {
    spinner.stop("Failed");
    p.cancel(err.message ?? String(err));
    process.exit(1);
  }
}

const program = new Command();

program
  .name("commitghost")
  .description("Generate a commit message from your staged diff using an LLM.")
  .option("-p, --provider <provider>", "override provider (anthropic|openai)")
  .option("-m, --model <model>", "override model")
  .option(
    "-n, --count <count>",
    `number of candidates (${MIN_CANDIDATES}-${MAX_CANDIDATES})`,
    (v) => {
      const n = parseInt(v, 10);
      if (isNaN(n) || n < MIN_CANDIDATES || n > MAX_CANDIDATES) {
        throw new InvalidArgumentError(
          `must be a number between ${MIN_CANDIDATES} and ${MAX_CANDIDATES}.`,
        );
      }
      return n;
    },
  )
  .option("--dry-run", "print the chosen message instead of committing", false)
  .option(
    "--config",
    "open the interactive config wizard and write .commitghost.json",
    false,
  )
  .option(
    "-v, --verbose",
    "show file stats, token usage, cost estimate, and timing",
  )
  .option("--no-verbose", "force verbose output off, even if enabled in config")
  .action((opts) => generateAndCommit(opts));

program
  .command("ghost-check")
  .description(
    "Print a ghost if the working tree diff exceeds the configured line threshold (used by the shell prompt hook).",
  )
  .action(() => ghostCheck());

program
  .command("shell-init <shell>")
  .description(
    'Print shell integration snippet for the diff-size ghost prompt (zsh|bash). Usage: eval "$(commitghost shell-init zsh)"',
  )
  .action((shell: string) => shellInit(shell));

program
  .command("install-ghost [shell]")
  .description(
    "One-step setup: appends the ghost hook to your ~/.zshrc or ~/.bashrc. Auto-detects your shell if not given.",
  )
  .action((shell?: string) => runInstallGhost(shell));

program
  .command("uninstall-ghost [shell]")
  .description(
    "Removes the ghost hook previously added by install-ghost. Auto-detects your shell if not given.",
  )
  .action((shell?: string) => runUninstallGhost(shell));

program.addHelpText(
  "after",
  `
Examples:
  $ git add -A
  $ commitghost                     Generate and pick a commit message, then commit
  $ git commitg                     Same thing, invoked as a git subcommand
  $ commitghost --dry-run           Preview a message without committing
  $ commitghost -p openai           Use OpenAI instead of Anthropic
  $ commitghost -n 5                Generate 5 candidates instead of 3
  $ commitghost -v                  Show file stats, token usage, cost, and timing
  $ commitghost --no-verbose        Force verbose off, even if enabled in config
  $ commitghost --config            Open the interactive config wizard
  $ commitghost install-ghost       Set up the ghost warning in your shell (one step)
  $ commitghost uninstall-ghost     Remove the ghost warning hook
  $ commitghost ghost-check         Print a ghost if the diff is over threshold
  $ commitghost shell-init zsh      Print the raw zsh integration snippet (manual setup)

Config:
  Add a .commitghost.json file in your repo root to set defaults:
    {
      "provider": "anthropic",
      "model": "claude-haiku-4-5-20251001",
      "style": "conventional commits, no body",
      "candidateCount": 3,
      "warnLines": 150,
      "verbose": false
    }

API keys:
  Run "commitghost --config" to enter your API key interactively —
  it's saved to ~/.commitghost/credentials (chmod 600) and reused
  automatically. Environment variables below take priority if set.

Environment variables:
  ANTHROPIC_API_KEY       overrides the stored key for the anthropic provider
  OPENAI_API_KEY          overrides the stored key for the openai provider
  COMMITGHOST_PROVIDER    default provider if not set in config
  COMMITGHOST_WARN_LINES  default ghost-check threshold if not set in config

Shell prompt ghost:
  Run:
    commitghost install-ghost
  This appends a hook to your ~/.zshrc or ~/.bashrc automatically
  (auto-detects your shell). A ghost 👻 prints above your prompt
  once your working tree diff exceeds the warnLines threshold, and
  stops once you commit. Safe to run more than once — it won't
  install itself twice. Remove it with "commitghost uninstall-ghost".
  Prefer to wire it in by hand instead? See
  "commitghost shell-init <zsh|bash>".
`,
);

program.parse(process.argv);
