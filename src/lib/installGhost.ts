import { readFile, appendFile, writeFile } from "node:fs/promises";
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

export async function isGhostInstalled(
  shell: SupportedShell,
): Promise<boolean> {
  try {
    const existing = await readFile(rcFileFor(shell), "utf-8");
    return existing.includes(MARKER_START);
  } catch (err: any) {
    if (err.code === "ENOENT") return false;
    throw err;
  }
}

export interface InstallResult {
  status: "installed" | "already-installed";
  rcFile: string;
}

export async function installGhost(
  shell: SupportedShell,
): Promise<InstallResult> {
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

export interface UninstallResult {
  status: "removed" | "not-installed";
  rcFile: string;
}

export async function uninstallGhost(
  shell: SupportedShell,
): Promise<UninstallResult> {
  const rcFile = rcFileFor(shell);

  let existing: string;
  try {
    existing = await readFile(rcFile, "utf-8");
  } catch (err: any) {
    if (err.code === "ENOENT") return { status: "not-installed", rcFile };
    throw err;
  }

  const startIdx = existing.indexOf(MARKER_START);
  const endIdx = existing.indexOf(MARKER_END);

  if (startIdx === -1 || endIdx === -1) {
    return { status: "not-installed", rcFile };
  }

  const before = existing.slice(0, startIdx).replace(/\n+$/, "");
  const after = existing.slice(endIdx + MARKER_END.length).replace(/^\n+/, "");

  const cleaned =
    [before, after].filter(Boolean).join("\n\n") +
    (after || before ? "\n" : "");

  await writeFile(rcFile, cleaned, "utf-8");

  return { status: "removed", rcFile };
}
