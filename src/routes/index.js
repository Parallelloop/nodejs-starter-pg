import express from "express";
import auth from "./auth";
import user from "./users";
import integrations from "./integrations";
import workspaces from "./workspaces";
import explore from "./explore";
import webhooks from "./webhooks";
import memory from "./memory";
import { authenticateAuthToken } from "../middlewares/auth";

const router = express.Router();
router.use("/auth", auth);
router.use("/users", authenticateAuthToken, user);
router.use("/integrations", integrations);
router.use("/workspaces", authenticateAuthToken, workspaces);
router.use("/explore", authenticateAuthToken, explore);
router.use("/memory", authenticateAuthToken, memory);
router.use("/webhooks", webhooks);

export default router;
