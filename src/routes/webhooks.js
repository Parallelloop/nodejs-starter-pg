import express from "express";
import { HandleGithubWebhook, HandleGoogleWebhook } from "../controllers/webhooks";

const router = express.Router();

router.post("/github", HandleGithubWebhook);
router.post("/google", HandleGoogleWebhook);

export default router;
