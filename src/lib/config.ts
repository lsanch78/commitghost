import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

export type Provider = "anthropic" | "openai";

export interface Config {
  provider: Provider;
  model?: string;
  style?: string;
  candidateCount: number;
  warnLines: number;
}

export const MIN_CANDIDATES = 1;
export const MAX_CANDIDATES = 10;

export function clampCandidateCount(n: number): number {
  return Math.min(MAX_CANDIDATES, Math.max(MIN_CANDIDATES, Math.round(n)));
}

const DEFAULTS: Config = {
  provider: "anthropic",
  candidateCount: 3,
  warnLines: 150,
};

const CONFIG_FILENAMES = [".commitghost.json", ".commitghostrc.json"];

export async function loadConfig(): Promise<Config> {
  const cwd = process.cwd();

  for (const filename of CONFIG_FILENAMES) {
    try {
      const raw = await readFile(path.join(cwd, filename), "utf-8");
      const parsed = JSON.parse(raw);
      const merged = { ...DEFAULTS, ...parsed };
      merged.candidateCount = clampCandidateCount(merged.candidateCount);
      return merged;
    } catch (err: any) {
      if (err.code !== "ENOENT") throw err;
    }
  }

  const envProvider = process.env.COMMITGHOST_PROVIDER as Provider | undefined;
  return {
    ...DEFAULTS,
    ...(envProvider ? { provider: envProvider } : {}),
  };
}

export const CONFIG_PATH = () => path.join(process.cwd(), CONFIG_FILENAMES[0]);

export async function writeConfig(config: Config): Promise<string> {
  const target = CONFIG_PATH();
  await writeFile(target, JSON.stringify(config, null, 2) + "\n", "utf-8");
  return target;
}
