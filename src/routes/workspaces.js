import express from "express";
import { CreateWorkspace, InviteUser, GetWorkspaceMembers, GetUserWorkspaces, RemoveMember } from "../controllers/workspaces";
import { LinkRepoSlack } from "../controllers/integrations";

const router = express.Router();

router.get("/", GetUserWorkspaces);
router.post("/create", CreateWorkspace);
router.post("/invite", InviteUser);
router.get("/members", GetWorkspaceMembers);
router.delete("/members", RemoveMember);

// Repo Linking
router.post("/workspace-repo/link-slack", LinkRepoSlack);

export default router;
