import express from "express";
import { HandleGithubWebhook, HandleGoogleWebhook, HandleBotTranscript } from "../controllers/webhooks";

const router = express.Router();

router.post("/github", HandleGithubWebhook);
router.post("/google", HandleGoogleWebhook);
router.post("/bot-transcript", HandleBotTranscript);

export default router;
