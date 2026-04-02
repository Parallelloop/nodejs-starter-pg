import express from "express";
import { GetDecisions, GetKnowledgeGaps, UpdateSopJustification } from "../controllers/memory/list";
import { authenticateAuthToken } from "../middlewares/auth";

const router = express.Router();

router.get("/decisions", authenticateAuthToken, GetDecisions);
router.get("/knowledge-gaps", authenticateAuthToken, GetKnowledgeGaps);
router.put("/knowledge-gaps/:id", authenticateAuthToken, UpdateSopJustification);

export default router;
