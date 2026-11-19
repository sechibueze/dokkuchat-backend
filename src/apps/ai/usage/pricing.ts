// USD per 1M tokens. .
const PRICING_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  'text-embedding-3-small': { input: 0.02, output: 0 },
  'text-embedding-3-large': { input: 0.13, output: 0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
};

export function calculateCostUsd(model: string, promptTokens: number, completionTokens: number) {
  const price = PRICING_PER_MILLION_TOKENS[model];
  if (!price) return 0;
  return (promptTokens * price.input + completionTokens * price.output) / 1_000_000;
}
