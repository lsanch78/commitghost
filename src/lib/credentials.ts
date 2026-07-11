import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

export type CredentialKey = "ANTHROPIC_API_KEY" | "OPENAI_API_KEY";

const CONFIG_DIR = path.join(homedir(), ".commitghost");
const CREDENTIALS_PATH = path.join(CONFIG_DIR, "credentials");

type Credentials = Partial<Record<CredentialKey, string>>;

export async function readCredentials(): Promise<Credentials> {
  try {
    const raw = await readFile(CREDENTIALS_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (err: any) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
}

export async function setCredential(key: CredentialKey, value: string): Promise<string> {
  const current = await readCredentials();
  const next = { ...current, [key]: value };

  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await writeFile(CREDENTIALS_PATH, JSON.stringify(next, null, 2) + "\n", {
    encoding: "utf-8",
    mode: 0o600,
  });

  return CREDENTIALS_PATH;
}

export async function getCredential(key: CredentialKey): Promise<string | undefined> {
  if (process.env[key]) return process.env[key];
  const stored = await readCredentials();
  return stored[key];
}
