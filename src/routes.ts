import { Router } from 'express';

export const routes = Router();

const v1 = Router();
v1.use('/health', (req, res) => {
  res.json({ app: 'Dokkuchat API v1', message: 'Welcome to Dokkuchat API v1' });
});
routes.use('/api/v1', v1);
