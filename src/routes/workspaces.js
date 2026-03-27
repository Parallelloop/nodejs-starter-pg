import express from "express";
import { CreateWorkspace, InviteUser, GetWorkspaceMembers, GetUserWorkspaces, RemoveMember } from "../controllers/workspaces";

const router = express.Router();

router.get("/", GetUserWorkspaces);
router.post("/create", CreateWorkspace);
router.post("/invite", InviteUser);
router.get("/members", GetWorkspaceMembers);
router.delete("/members", RemoveMember);

export default router;
