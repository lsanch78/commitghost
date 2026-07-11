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

const REGENERATE = "__commitghost_regenerate__";
const EDIT = "__commitghost_edit__";
const CANCEL = "__commitghost_cancel__";

async function pickMessage(
  candidates: string[]
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

async function generateAndCommit(opts: any) {
  if (opts.config) {
    await runConfigWizard();
    return;
  }

  p.intro("commitghost");

  const config = await loadConfig();
  if (opts.provider) config.provider = opts.provider;
  if (opts.count) config.candidateCount = opts.count;

  const spinner = p.spinner();

  try {
    spinner.start("Reading staged diff");
    const { diff, filesChanged, recentSubjects } = await getStagedDiffContext();
    const { diff: safeDiff, truncated } = truncateDiff(diff);
    spinner.stop(
      `Read diff across ${filesChanged.length} file(s)${truncated ? " (truncated for length)" : ""}`
    );

    const provider = getProvider(config.provider);

    let candidates: string[] = [];
    let result: string | typeof REGENERATE | typeof CANCEL;

    do {
      spinner.start(`Asking ${provider.name} for commit message candidates`);
      candidates = await provider.generate({
        diff: safeDiff,
        filesChanged,
        recentSubjects,
        style: config.style,
        candidateCount: config.candidateCount,
        model: opts.model ?? config.model,
      });
      spinner.stop("Got candidates");

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
          `must be a number between ${MIN_CANDIDATES} and ${MAX_CANDIDATES}.`
        );
      }
      return n;
    }
  )
  .option("--dry-run", "print the chosen message instead of committing", false)
  .option("--config", "open the interactive config wizard and write .commitghost.json", false)
  .action((opts) => generateAndCommit(opts));

program
  .command("ghost-check")
  .description("Print a ghost if the working tree diff exceeds the configured line threshold (used by the shell prompt hook).")
  .action(() => ghostCheck());

program
  .command("shell-init <shell>")
  .description("Print shell integration snippet for the diff-size ghost prompt (zsh|bash). Usage: eval \"$(commitghost shell-init zsh)\"")
  .action((shell: string) => shellInit(shell));

program.addHelpText(
  "after",
  `
Examples:
  $ git add -A
  $ commitghost                     Generate and pick a commit message, then commit
  $ commitghost --dry-run           Preview a message without committing
  $ commitghost -p openai           Use OpenAI instead of Anthropic
  $ commitghost -n 5                Generate 5 candidates instead of 3
  $ commitghost --config            Open the interactive config wizard
  $ commitghost ghost-check         Print a ghost if the diff is over threshold
  $ commitghost shell-init zsh      Print the zsh prompt integration snippet

Config:
  Add a .commitghost.json file in your repo root to set defaults:
    {
      "provider": "anthropic",
      "model": "claude-haiku-4-5-20251001",
      "style": "conventional commits, no body",
      "candidateCount": 3,
      "warnLines": 150
    }

Environment variables:
  ANTHROPIC_API_KEY       required when using the anthropic provider
  OPENAI_API_KEY          required when using the openai provider
  COMMITGHOST_PROVIDER    default provider if not set in config
  COMMITGHOST_WARN_LINES  default ghost-check threshold if not set in config

Shell prompt ghost:
  Add to ~/.zshrc (or ~/.bashrc):
    eval "$(commitghost shell-init zsh)"
    PROMPT='%~ $(commitghost_prompt)%# '
  A ghost (o_o) appears in your prompt once your working tree diff
  exceeds the warnLines threshold, and disappears once you commit.
`
);

program.parse(process.argv);
