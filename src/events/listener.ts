import { logger } from '@/libs/logger';
import { appEvents } from '.';
import { userRepository } from '@/apps/users/user.repository';

export function registerAppEventListeners() {
  appEvents.on('http.request.completed', (event) => {
    const failed = event.outcome !== 'success';
    logger.log(failed ? 'warn' : 'debug', 'Outbound HTTP request', event);
  });

  appEvents.on('circuit.state.changed', ({ name, state }) => {
    logger.log(state === 'closed' ? 'info' : 'warn', `Circuit breaker ${state}`, { breaker: name });
  });

  appEvents.on('job.failed', (event) => logger.error('Job failed', event));

  appEvents.on('document.ready', ({ documentId, userId, documentName }) => {
    void (async () => {
      try {
        const user = await userRepository.getUserById(userId);
        if (user) {
          //   await notificationService.sendDocumentReadyEmail({
          //     to: user.email,
          //     name: user.name,
          //     documentName,
          //   });
          logger.info('Document-ready notification sent', {
            to: user.email,
            name: user.name,
            documentName,
          });
        }
      } catch (error) {
        logger.error('Document-ready notification failed', {
          documentId,
          error: (error as Error).message,
        });
      }
    })();
  });
}
