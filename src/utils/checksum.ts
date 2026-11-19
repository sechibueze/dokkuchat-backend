import { createHash } from 'node:crypto';

export const computeChecksum = (content: Buffer) =>
  createHash('sha256').update(content).digest('hex');
