import { Router } from 'express';
import { userController } from './user.controller';
import { authenticate } from '@/apps/auth/auth.middleware';
import { validateRequest } from '@/middlewares/validate.middleware';
import { updateProfileSchema } from './user.schema';
export const userRouter = Router();

userRouter.use(authenticate);
userRouter.get('/me', userController.getMyProfile);
userRouter.patch('/me', validateRequest(updateProfileSchema), userController.updateMyProfile);
userRouter.delete('/me', userController.deleteMyAccount);
