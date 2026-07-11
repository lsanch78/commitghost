import { execFileSync } from "node:child_process";

function changedLines(args: string[]): number {
  let out: string;
  try {
    out = execFileSync("git", ["diff", "--shortstat", ...args], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return 0;
  }

  const insMatch = out.match(/(\d+) insertions?\(\+\)/);
  const delMatch = out.match(/(\d+) deletions?\(-\)/);
  const insertions = insMatch ? parseInt(insMatch[1], 10) : 0;
  const deletions = delMatch ? parseInt(delMatch[1], 10) : 0;

  return insertions + deletions;
}

export function getWorkingTreeLinesChanged(): number {
  return changedLines(["--staged"]) + changedLines([]);
}
