import DB from "../../database";
import { getJiraCloudId, fetchActiveJiraTasks, refreshJiraToken } from "../../utils/jira";

async function triggerSopGuard(pull_request, repository, workspaceId, reason, detail) {
    try {
        // 1. Log as Knowledge Gap / Decision Log (Internal to App)
        await DB.decisionLogs.create({
            workspaceId,
            title: `SOP Guard: ${reason}`,
            rationale: detail,
            linkedPrId: pull_request.html_url
        });
    } catch (err) {
        console.error("Internal SOP Guard logging failed: ", err.message);
    }
}

const HandlePrMerge = async (req, res) => {
    // 1. Log Raw Request for Debugging
    console.log("--- WEBHOOK RECEIVED ---");
    console.log("Headers:", JSON.stringify(req.headers, null, 2));

    // GitHub with 'application/x-www-form-urlencoded' sends the JSON in a 'payload' field
    let payload = req.body;
    if (req.body.payload && typeof req.body.payload === 'string') {
        try {
            payload = JSON.parse(req.body.payload);
        } catch (e) {
            console.error("Failed to parse GitHub form-encoded payload JSON");
        }
    }

    console.log("Event:", req.headers["x-github-event"]);
    console.log("Action:", payload.action);
    console.log("PR ID:", payload.pull_request?.html_url);
    console.log("------------------------");

    try {
        const { action, pull_request, repository } = payload;
        const repoFullName = repository?.full_name;

        if (!pull_request || !repoFullName) {
            return res.status(200).json({ status: 'ignored_no_pr_or_repo', action });
        }

        const prId = pull_request.html_url;
        const branchName = pull_request.head?.ref || "unknown";

        // Fetch workspaceRepo using only the repository name (enables standard webhook URLs)
        const workspaceRepo = await DB.workspaceRepos.findOne({
            where: { repoFullName },
            include: [
                { model: DB.workspaces },
                { 
                    model: DB.workspaceRepoBoards, 
                    as: "workspaceRepoBoards",
                    include: [{ model: DB.jiraBoards, as: "jiraBoard" }]
                }
            ]
        });

        if (!workspaceRepo) {
            console.error(`Rejected webhook for ${repoFullName}: No linked workspaceRepo found.`);
            return res.status(404).json({ error: "Repository configuration not found for this workspace" });
        }

        const workspaceId = workspaceRepo.workspaceId;

        // Verify with JIRA API - Ground Truth Check
        const jiraIntegration = await DB.integrations.findOne({
            where: { userId: workspaceRepo.assignedBy, type: 'jira' }
        });

        if (!jiraIntegration) {
            console.error(`No Jira integration found for user ${workspaceRepo.assignedBy}`);
            return res.status(403).json({ error: "Jira integration not found for workspace assigner" });
        }

        let cloudId;
        let activeTasks;

        const linkedBoardIds = workspaceRepo.workspaceRepoBoards?.map(b => b.jiraBoard?.boardId) || [];
        console.log(`Webhook fetching tasks for linked boards: [${linkedBoardIds.join(", ")}]`);

        try {
            cloudId = await getJiraCloudId(jiraIntegration.accessToken);
            if (!cloudId) throw new Error("No cloud ID found");
            activeTasks = await fetchActiveJiraTasks(jiraIntegration.accessToken, cloudId, linkedBoardIds);
        } catch (e) {
            if (e.message === "401") {
                console.log("Jira Access Token expired. Attempting refresh...");
                const newAccessToken = await refreshJiraToken(jiraIntegration);
                cloudId = await getJiraCloudId(newAccessToken);
                activeTasks = await fetchActiveJiraTasks(newAccessToken, cloudId, linkedBoardIds);
            } else {
                throw e;
            }
        }

        const activeTaskKeys = activeTasks.map(t => t.key);
        console.log("Active Jira Tasks identified from Board:", activeTaskKeys.join(", "));

        // 2. Check Branch Name against REAL task ID list from Jira (No Assuming)
        if (action === "opened" || action === "synchronize" || action === "reopened") {
            const branchMatches = activeTaskKeys.filter(key => branchName.includes(key));

            if (branchMatches.length === 0) {
                // 3. Create SOP Guard entry
                const reason = "Jira Link Broken - Invalid Branch Name";
                const detail = `The branch \`${branchName}\` does not correspond to any active tasks in the Jira board. Found active tasks: [${activeTaskKeys.join(", ") || 'None Found'}].`;

                await DB.sopGuard.create({
                    workspaceId,
                    workspaceRepoId: workspaceRepo.id,
                    slackChannelId: workspaceRepo.slackChannelId,
                    prId,
                    branchName,
                    jiraTaskIds: "",
                    status: 'failed',
                    reason: detail
                });

                await triggerSopGuard(
                    pull_request,
                    repository,
                    workspaceId,
                    reason,
                    detail
                );

                return res.status(200).json({ status: 'sop_failed', branchName, activeTasks: activeTaskKeys });
            } else {
                // Success log
                await DB.sopGuard.create({
                    workspaceId,
                    workspaceRepoId: workspaceRepo.id,
                    slackChannelId: workspaceRepo.slackChannelId,
                    prId,
                    branchName,
                    jiraTaskIds: branchMatches.join(", "),
                    status: 'passed'
                });

                return res.status(200).json({ status: 'sop_passed', jiraIds: branchMatches });
            }
        }

        return res.status(200).json({ status: 'processed', action });
    } catch (err) {
        console.error("Webhook Error: ", err.message);
        try {
            // 4. Log Error in sopGuard table
            if (payload.pull_request) {
                const repoName = payload.repository?.full_name;
                const wsRepo = await DB.workspaceRepos.findOne({
                    where: { repoFullName: repoName }
                });

                await DB.sopGuard.create({
                    workspaceId: wsRepo?.workspaceId || 0,
                    workspaceRepoId: wsRepo?.id,
                    slackChannelId: wsRepo?.slackChannelId,
                    prId: payload.pull_request.html_url,
                    branchName: payload.pull_request.head?.ref || "unknown",
                    status: 'error',
                    error: err.message
                });
            }
        } catch (dbErr) {
            console.error("Critical: Could not log error to sopGuard table", dbErr.message);
        }
        return res.status(500).json({ error: err.message });
    }
};

export default HandlePrMerge;
