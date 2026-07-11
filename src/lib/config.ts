import { readFile } from "node:fs/promises";
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
      return { ...DEFAULTS, ...parsed };
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
