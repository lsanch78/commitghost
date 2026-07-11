import type { GenerateOptions } from "./types.js";

export function buildPrompt(options: GenerateOptions): { system: string; user: string } {
  const { diff, filesChanged, recentSubjects, style, candidateCount } = options;

  const styleHint = style
    ? `Follow this style guide strictly: ${style}`
    : recentSubjects.length > 0
      ? `Match the style (tense, length, prefix conventions like "feat:"/"fix:", punctuation) of these recent commit subjects from this repo:\n${recentSubjects
          .slice(0, 10)
          .map((s) => `- ${s}`)
          .join("\n")}`
      : "Use conventional commit style (e.g. feat:, fix:, chore:, refactor:, docs:) with an imperative mood subject line.";

  const system = [
    "You are commitghost, a CLI assistant that writes git commit messages from a staged diff.",
    "Write concise, accurate commit messages that describe WHY and WHAT changed at a glance.",
    "Never invent changes that aren't in the diff. Never include a trailing period on the subject line.",
    "Subject line should be under 72 characters. Add a short body only if the change is non-trivial.",
    styleHint,
    `Return exactly ${candidateCount} distinct candidate commit messages, most likely first.`,
    "Respond with ONLY the candidates, one per line, no numbering, no extra commentary.",
  ].join("\n");

  const user = [
    `Files changed:\n${filesChanged.map((f) => `- ${f}`).join("\n")}`,
    "",
    "Staged diff:",
    "```diff",
    diff,
    "```",
  ].join("\n");

  return { system, user };
}

export function parseCandidates(raw: string, expected: number): string[] {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean);

  return lines.slice(0, expected);
}
