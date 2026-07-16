interface ModelPrice {
  inputPerMillion: number;
  outputPerMillion: number;
}

const PRICING: Record<string, ModelPrice> = {
  "claude-haiku-4-5-20251001": { inputPerMillion: 1, outputPerMillion: 5 },
  "claude-sonnet-5": { inputPerMillion: 3, outputPerMillion: 15 },
  "claude-opus-4-8": { inputPerMillion: 15, outputPerMillion: 75 },
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  "gpt-4o": { inputPerMillion: 2.5, outputPerMillion: 10 },
};

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | undefined {
  const price = PRICING[model];
  if (!price) return undefined;

  return (
    (inputTokens / 1_000_000) * price.inputPerMillion +
    (outputTokens / 1_000_000) * price.outputPerMillion
  );
}

export function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(5)}`;
  return `$${cost.toFixed(4)}`;
}

// Rough joules-per-token heuristic for consumer-GPU local inference (e.g. Ollama).
// Prefill (input) tokens batch in parallel and are far cheaper per-token than
// sequential generation (output) tokens. These are ballpark figures, not measurements.
const JOULES_PER_INPUT_TOKEN = 0.4;
const JOULES_PER_OUTPUT_TOKEN = 3;

export function estimateEnergyKWh(
  inputTokens: number,
  outputTokens: number,
): number {
  const joules =
    inputTokens * JOULES_PER_INPUT_TOKEN +
    outputTokens * JOULES_PER_OUTPUT_TOKEN;
  return joules / 3_600_000;
}

export function formatEnergy(kWh: number): string {
  const wattHours = kWh * 1000;
  if (wattHours < 1) return `${(wattHours * 1000).toFixed(0)} mWh`;
  return `${wattHours.toFixed(2)} Wh`;
}
