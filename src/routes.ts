import { Router } from 'express';

export const routes = Router();

const v1 = Router();
v1.use('/', (req, res) => {
  res.json({ message: 'Welcome to Dokkuchat API v1' });
});
routes.use('/api/v1', v1);
