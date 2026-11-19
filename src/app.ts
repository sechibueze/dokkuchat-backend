import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler, notFoundHandler, requestLogger } from './middleware';
import { routes } from './routes';
import { rateLimit, rateLimitPolicies } from './middlewares/rate-limit.middleware';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
  app.use(requestLogger);
  app.use('/api', rateLimit(rateLimitPolicies.global));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use(routes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
