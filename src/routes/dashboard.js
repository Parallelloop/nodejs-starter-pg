import express from 'express'
import uploadingFile, { upload } from '../controllers/order/uploadFile';

const router = express.Router();

router.post('/uploading-file', upload.single('ppc_file'), uploadingFile);

export default router;
