export const toPgVector = (embedding: number[]) => `[${embedding.join(',')}]`;
