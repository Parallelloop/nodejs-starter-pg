import express, { Router } from 'express';
import { updatePassword } from '../controllers/users';

const router: Router = express.Router();

router.post('/update-password', updatePassword);

export default router;
