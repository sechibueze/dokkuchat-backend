import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApiDocument } from './openapi';
import { allRouteDocs } from './routes.doc';

export function createDocsRouter() {
  const document = buildOpenApiDocument(allRouteDocs);
  const router = Router();
  router.get('/openapi.json', (_req, res) => res.json(document));
  router.use(
    '/',
    swaggerUi.serve,
    swaggerUi.setup(document, {
      customSiteTitle: 'Dokkuchat API',
      swaggerOptions: { persistAuthorization: true },
    }),
  );
  return router;
}
