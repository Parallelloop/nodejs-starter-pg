import express from "express";
import { authenticateAuthToken } from "../middlewares/auth";

import {
  ConnectIntegration,
  GetIntegrationsStatus,
  RefreshIntegrationToken,
  DisconnectIntegration,
  GitHubAuth, GitHubCallback,
  SlackAuth, SlackCallback,
  SlackSyncChannels, GetSlackChannels, LinkRepoSlack,
  JiraAuth, JiraCallback,
  ClickupAuth, ClickupCallback,
  SyncGitHubRepos, GetGitHubRepos,
  GetWorkspaceRepo, AssignWorkspaceRepo, GetGitHubRepoStats,
  SyncJiraBoards, JiraGetBoards, LinkRepoBoard,
  GoogleAuth, GoogleCallback, CreateMeeting
} from "../controllers/integrations";

const router = express.Router();

// Base integration APIs
router.post("/connect", authenticateAuthToken, ConnectIntegration);
router.get("/status", authenticateAuthToken, GetIntegrationsStatus);
router.post("/refresh", authenticateAuthToken, RefreshIntegrationToken);
router.post("/disconnect", authenticateAuthToken, DisconnectIntegration);

// Auth Initializer Routes (Requires user token)
router.get("/github/auth", authenticateAuthToken, GitHubAuth);
router.get("/slack/auth", authenticateAuthToken, SlackAuth);
router.get("/jira/auth", authenticateAuthToken, JiraAuth);
router.get("/clickup/auth", authenticateAuthToken, ClickupAuth);
router.get("/google/auth", authenticateAuthToken, GoogleAuth);

// OAuth Callback Routes (No user token header since browser redirects natively)
router.get("/github/callback", GitHubCallback);
router.get("/slack/callback", SlackCallback);
router.get("/jira/callback", JiraCallback);
router.get("/clickup/callback", ClickupCallback);
router.get("/google/callback", GoogleCallback);

// Meet / Meetings
router.post("/google/create-meeting", authenticateAuthToken, CreateMeeting);

// GitHub Repo Sync & Workspace Assignment
router.post("/github/sync-repos", authenticateAuthToken, SyncGitHubRepos);
router.get("/github/repos", authenticateAuthToken, GetGitHubRepos);
router.get("/workspace-repo", authenticateAuthToken, GetWorkspaceRepo);
router.post("/workspace-repo", authenticateAuthToken, AssignWorkspaceRepo);
router.get("/github/repo-stats", authenticateAuthToken, GetGitHubRepoStats);

// Slack Channel Sync & Repo Linking
router.post("/slack/sync-channels", authenticateAuthToken, SlackSyncChannels);
router.get("/slack/channels", authenticateAuthToken, GetSlackChannels);
router.post("/workspace-repo/link-slack", authenticateAuthToken, LinkRepoSlack);

router.post("/jira/sync-boards", authenticateAuthToken, SyncJiraBoards);
router.get("/jira/boards", authenticateAuthToken, JiraGetBoards);
router.post("/workspace-repo/link-jira", authenticateAuthToken, LinkRepoBoard);

export default router;
