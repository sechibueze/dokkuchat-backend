import type { Request, Response } from 'express';
import type { LoginInput, RegisterUserInput, ResetPasswordInput } from './auth.schema';
import { authService, type ClientContext } from './auth.service';
import { sendSuccess } from '@/utils/response';

const getClientContext = (req: Request): ClientContext => ({
  userAgent: req.get('user-agent'),
  ipAddress: req.ip,
});

export const authController = {
  async register(req: Request, res: Response) {
    const result = await authService.register(req.body as RegisterUserInput, getClientContext(req));
    sendSuccess(res, result, { status: 201 });
  },

  async login(req: Request, res: Response) {
    const result = await authService.login(req.body as LoginInput, getClientContext(req));
    sendSuccess(res, result);
  },

  async refresh(req: Request, res: Response) {
    const tokens = await authService.refreshAccessToken(
      req.body.refreshToken,
      getClientContext(req),
    );
    sendSuccess(res, tokens);
  },

  async logout(req: Request, res: Response) {
    await authService.logout(req.body.refreshToken);
    sendSuccess(res, { message: 'Logged out' });
  },

  async logoutAllSessions(req: Request, res: Response) {
    await authService.logoutAllSessions(req.user!.id);
    sendSuccess(res, { message: 'All sessions have been signed out' });
  },

  async forgotPassword(req: Request, res: Response) {
    await authService.forgotPassword(req.body.email);
    sendSuccess(res, {
      message: 'If an account exists for that email, a reset link has been sent',
    });
  },

  async resetPassword(req: Request, res: Response) {
    await authService.resetPassword(req.body as ResetPasswordInput);
    sendSuccess(res, { message: 'Password updated. Please sign in again.' });
  },
};
