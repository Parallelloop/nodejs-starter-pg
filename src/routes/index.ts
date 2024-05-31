import express, { Router } from 'express';
import auth from './auth';
import user from './users';
import { authenticateAuthToken } from '../middlewares/auth';

const router: Router = express.Router();

router.use('/auth', auth);
router.use('/users', authenticateAuthToken, user);

export default router;
