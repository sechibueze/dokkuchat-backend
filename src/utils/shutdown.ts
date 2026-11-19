import { logger } from '@/libs/logger';

const hooks: { name: string; run: () => Promise<unknown> }[] = [];

export function onShutdown(name: string, run: () => Promise<unknown>) {
  hooks.push({ name, run });
}

export async function runShutdownHooks() {
  for (const hook of [...hooks].reverse()) {
    try {
      await hook.run();
      logger.info('Shutdown hook completed', { hook: hook.name });
    } catch (error) {
      logger.error('Shutdown hook failed', { hook: hook.name, error: (error as Error).message });
    }
  }
}
