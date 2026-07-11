import { simpleGit } from "simple-git";

const git = simpleGit();

export interface DiffContext {
  diff: string;
  filesChanged: string[];
  recentSubjects: string[];
}

export async function getStagedDiffContext(): Promise<DiffContext> {
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    throw new Error("Not inside a git repository.");
  }

  const diff = await git.diff(["--staged"]);
  if (!diff.trim()) {
    throw new Error("No staged changes found. Run `git add` first.");
  }

  const status = await git.status();
  const filesChanged = status.staged;

  let recentSubjects: string[] = [];
  try {
    const log = await git.log({ maxCount: 20 });
    recentSubjects = log.all.map((entry) => entry.message);
  } catch {
    recentSubjects = [];
  }

  return { diff, filesChanged, recentSubjects };
}

export async function commit(message: string): Promise<void> {
  await git.commit(message);
}
