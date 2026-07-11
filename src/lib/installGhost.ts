import { readFile, appendFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { ZSH_INIT, BASH_INIT } from "./shellInit.js";

const MARKER_START = "# >>> commitghost ghost >>>";
const MARKER_END = "# <<< commitghost ghost <<<";

export type SupportedShell = "zsh" | "bash";

export function detectShell(): SupportedShell | undefined {
  const shellPath = process.env.SHELL ?? "";
  if (shellPath.includes("zsh")) return "zsh";
  if (shellPath.includes("bash")) return "bash";
  return undefined;
}

function rcFileFor(shell: SupportedShell): string {
  const file = shell === "zsh" ? ".zshrc" : ".bashrc";
  return path.join(homedir(), file);
}

export interface InstallResult {
  status: "installed" | "already-installed";
  rcFile: string;
}

export async function installGhost(shell: SupportedShell): Promise<InstallResult> {
  const rcFile = rcFileFor(shell);
  const snippet = shell === "zsh" ? ZSH_INIT : BASH_INIT;

  let existing = "";
  try {
    existing = await readFile(rcFile, "utf-8");
  } catch (err: any) {
    if (err.code !== "ENOENT") throw err;
  }

  if (existing.includes(MARKER_START)) {
    return { status: "already-installed", rcFile };
  }

  const block = `\n${MARKER_START}\n${snippet.trim()}\n${MARKER_END}\n`;
  await appendFile(rcFile, block, "utf-8");

  return { status: "installed", rcFile };
}
