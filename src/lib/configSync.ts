import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const CONFIG_FILENAMES = [".commitghost.json", ".commitghostrc.json"];
const DEFAULT_WARN_LINES = 150;

export function getWarnLinesSync(): number {
  const cwd = process.cwd();

  for (const filename of CONFIG_FILENAMES) {
    try {
      const raw = readFileSync(path.join(cwd, filename), "utf-8");
      const parsed = JSON.parse(raw);
      if (typeof parsed.warnLines === "number") return parsed.warnLines;
      return DEFAULT_WARN_LINES;
    } catch (err: any) {
      if (err.code !== "ENOENT") return DEFAULT_WARN_LINES;
    }
  }

  const envValue = process.env.COMMITGHOST_WARN_LINES;
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed)) return parsed;
  }

  return DEFAULT_WARN_LINES;
}
