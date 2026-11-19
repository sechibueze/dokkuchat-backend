import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from './auth.middleware';
import {
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
} from './auth.schema';
import { validateRequest } from '@/middlewares/validate.middleware';

export const authRouter = Router();

authRouter.post('/register', validateRequest(registerSchema), authController.register);
authRouter.post('/login', validateRequest(loginSchema), authController.login);
authRouter.post('/refresh', validateRequest(refreshTokenSchema), authController.refresh);
authRouter.post('/logout', validateRequest(refreshTokenSchema), authController.logout);
authRouter.post('/logout-all', authenticate, authController.logoutAllSessions);
authRouter.post(
  '/forgot-password',
  validateRequest(forgotPasswordSchema),
  authController.forgotPassword,
);
authRouter.post(
  '/reset-password',
  validateRequest(resetPasswordSchema),
  authController.resetPassword,
);
