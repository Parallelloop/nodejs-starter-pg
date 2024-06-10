import express, { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import {
  SignIn,
  SignUp,
  ForgetPassword,
  ResetPassword
} from '../controllers/auth';
import { authenticateAuthToken } from '../middlewares/auth';

declare module 'express-serve-static-core' {
  interface Request {
    error?: any;
    user?: any;
  }
}

const router = express.Router();

const loginCheck = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('local', (err: any, user: any, info: any) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      req.error = info?.error;
    } else {
      req.user = user;
    }
    next();
  })(req, res, next);
};

router.post('/signin', loginCheck, SignIn);
router.post('/signup', SignUp);
router.post('/forgetpassword', ForgetPassword);
router.put('/resetpassword', authenticateAuthToken, ResetPassword);

export default router;
