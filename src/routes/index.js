import express from 'express';
import auth from './auth';
import user from './users';
import dashboard from './dashboard';
import { authenticateAuthToken } from '../middlewares/auth';

const router = express.Router();
router.use('/auth', auth);
router.use('/users', authenticateAuthToken, user);
router.use('/dashboard', dashboard);

export default router;
