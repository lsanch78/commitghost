#!/usr/bin/env node
import { Command } from "commander";
import * as p from "@clack/prompts";
import { getStagedDiffContext, commit } from "./lib/git.js";
import { truncateDiff } from "./lib/diff.js";
import { loadConfig } from "./lib/config.js";
import { getProvider } from "./providers/index.js";
import { getWorkingTreeLinesChanged } from "./lib/diffSize.js";
import { getWarnLinesSync } from "./lib/configSync.js";
import { GHOST } from "./lib/ghost.js";
import { ZSH_INIT, BASH_INIT } from "./lib/shellInit.js";

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
  .option("-n, --count <count>", "number of candidates", (v) => parseInt(v, 10))
  .option("--dry-run", "print the chosen message instead of committing", false)
  .action((opts) => generateAndCommit(opts));

program
  .command("ghost-check")
  .description("Print a ghost if the working tree diff exceeds the configured line threshold (used by the shell prompt hook).")
  .action(() => ghostCheck());

program
  .command("shell-init <shell>")
  .description("Print shell integration snippet for the diff-size ghost prompt (zsh|bash). Usage: eval \"$(commitghost shell-init zsh)\"")
  .action((shell: string) => shellInit(shell));

program.parse(process.argv);
