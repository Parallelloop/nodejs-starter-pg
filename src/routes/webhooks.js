import express from "express";
import { HandlePrMerge } from "../controllers/webhooks";

const router = express.Router();

router.post("/github", HandlePrMerge);

export default router;
