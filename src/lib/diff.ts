const MAX_DIFF_CHARS = 12000;

export function truncateDiff(diff: string): { diff: string; truncated: boolean } {
  if (diff.length <= MAX_DIFF_CHARS) {
    return { diff, truncated: false };
  }

  const perFile = diff.split(/^diff --git /m).filter(Boolean);
  const budget = Math.floor(MAX_DIFF_CHARS / perFile.length);

  const shortened = perFile
    .map((chunk) => {
      const full = `diff --git ${chunk}`;
      return full.length > budget
        ? full.slice(0, budget) + "\n... [truncated]\n"
        : full;
    })
    .join("");

  return { diff: shortened, truncated: true };
}
