import DB from "../../database";
import { getJiraCloudId, fetchActiveJiraTasks, refreshJiraToken } from "../../utils/jira";
import { generateEmbedding } from "../../utils/embeddings";
import { lazyMessages } from "../../utils/constants";



const HandleGithubWebhook = async (req, res) => {
    console.log("--- WEBHOOK RECEIVED ---");
    const event = req.headers["x-github-event"];
    console.log("Event:", event);

    let payload = req.body;
    if (req.body.payload && typeof req.body.payload === 'string') {
        try {
            payload = JSON.parse(req.body.payload);
        } catch (e) {
            console.error("Failed to parse GitHub form-encoded payload JSON");
        }
    }

    const action = payload.action;
    const repository = payload.repository;
    const repoId = String(repository?.id);
    const repoFullName = repository?.full_name;
    const sender = payload.sender?.login || "unknown";

    if (!repoId) {
        return res.status(200).json({ status: 'ignored_no_repo_id' });
    }

    try {
        // Fetch workspaceRepo
        const workspaceRepo = await DB.workspaceRepos.findOne({
            where: { repoId },
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
            console.error(`Rejected webhook for ${repoFullName} (ID: ${repoId}): No linked workspaceRepo found.`);
            return res.status(404).json({ error: "Repository configuration not found for this workspace" });
        }

        const workspaceId = workspaceRepo.workspaceId;

        // --- HANDLE PUSH (COMMIT) EVENT ---
        if (event === "push") {
            const branchName = payload.ref?.split("/").pop() || "unknown";
            const commits = payload.commits || [];

            for (const commit of commits) {
                if (commit.message.length <= 100) {
                    const reason = `Commit message too short. Minimum required is 100 chars for semantic trace. (Length: ${commit.message.length})`;

                    const existing = await DB.sopGuard.findOne({
                        where: { workspaceId, branchName, status: 'failed', reason: { [DB.Sequelize.Op.like]: `Commit message too short%` } }
                    });

                    if (!existing) {
                        await DB.sopGuard.create({
                            workspaceId,
                            workspaceRepoId: workspaceRepo.id,
                            slackChannelId: workspaceRepo.slackChannelId,
                            prId: "N/A",
                            commitId: commit.url,
                            branchName,
                            triggeredBy: sender,
                            status: 'failed',
                            reason,
                            severity: "high"
                        });
                    }
                }
            }
            return res.status(200).json({ status: 'processed_push' });
        }

        // --- HANDLE PULL REQUEST EVENT ---
        if (event === "pull_request") {
            const action = payload.action;
            if (action === "closed") {
                return res.status(200).json({ status: 'ignored_pr_closed' });
            }

            const pull_request = payload.pull_request;
            const prId = pull_request.html_url;
            const branchName = pull_request.head?.ref || "unknown";

            // Verify with JIRA API - Ground Truth Check
            const jiraIntegration = await DB.integrations.findOne({
                where: { userId: workspaceRepo.assignedBy, type: 'jira' }
            });

            if (!jiraIntegration) {
                console.error(`No Jira integration found for user ${workspaceRepo.assignedBy}`);
                return res.status(403).json({ error: "Jira integration not found" });
            }

            let cloudId;
            let activeTasks;
            const linkedBoardIds = workspaceRepo.workspaceRepoBoards?.map(b => b.jiraBoard?.boardId) || [];

            try {
                cloudId = await getJiraCloudId(jiraIntegration.accessToken);
                activeTasks = await fetchActiveJiraTasks(jiraIntegration.accessToken, cloudId, linkedBoardIds);
            } catch (e) {
                if (e.message === "401") {
                    const newAccessToken = await refreshJiraToken(jiraIntegration);
                    cloudId = await getJiraCloudId(newAccessToken);
                    activeTasks = await fetchActiveJiraTasks(newAccessToken, cloudId, linkedBoardIds);
                } else {
                    throw e;
                }
            }

            let sopFailures = [];

            // --- MATCH JIRA TASK ---
            // Case-insensitive match between branch name and Jira keys
            const matchedTask = activeTasks.find(t => t.key.toLowerCase() === branchName.toLowerCase());

            // --- DEFINE SOP RULES ---
            let justificationMessage = "Policy alignment verified through automated scan.";
            
            // Handle Jira description (String or Atlassian Document Format)
            const rawJiraDesc = matchedTask?.fields?.description;
            let cleanJiraDesc = "";

            if (typeof rawJiraDesc === 'string') {
                cleanJiraDesc = rawJiraDesc;
            } else if (rawJiraDesc && typeof rawJiraDesc === 'object') {
                // Extract text from ADF (Atlassian Document Format)
                try {
                    const extractText = (obj) => {
                        if (obj.text) return obj.text;
                        if (obj.content && Array.isArray(obj.content)) {
                            return obj.content.map(extractText).join(" ");
                        }
                        return "";
                    };
                    cleanJiraDesc = extractText(rawJiraDesc);
                } catch (e) {
                    cleanJiraDesc = "";
                }
            }

            const jiraDescWords = cleanJiraDesc.trim().split(/\s+/).filter(w => w.length > 0).length;
            
            const prBodyWords = (pull_request.body || "").trim().split(/\s+/).filter(w => w.length > 0).length;
            const prTitleWords = (pull_request.title || "").trim().split(/\s+/).filter(w => w.length > 0).length;
            const prTitleLower = (pull_request.title || "").toLowerCase();

            const sopRules = [
                {
                    key: "BRANCH_ALIGNMENT",
                    name: "Branch Name Mismatch",
                    passed: !!matchedTask,
                    severity: "high",
                    errorDetail: `The PR branch name \`${branchName}\` does not match any active Jira task key.`,
                    successMsg: `${sender} has aligned the branch name with the Kore SOP requirements.`
                },
                {
                    key: "JIRA_DESC_DEPTH",
                    name: "Jira Description Too Short",
                    // ONLY EVALUATE DEPTH IF BRANCH ALREADY MATCHES
                    passed: !matchedTask || jiraDescWords >= 20,
                    severity: "high",
                    errorDetail: `The matched Jira task \`${branchName}\` description is too short (Words: ${jiraDescWords}). Minimum 20 words required.`,
                    successMsg: `Jira task description for \`${branchName}\` has been updated to meet SOP quality standards.`
                },
                {
                    key: "PR_DESC_DEPTH",
                    name: "PR Description Too Short",
                    passed: prBodyWords >= 20,
                    severity: "medium",
                    errorDetail: `Pull Request description is too short (Words: ${prBodyWords}). Minimum 20 words required.`,
                    successMsg: `${sender} has updated the pull request description and it follows the Kore SOP.`
                },
                {
                    key: "PR_TITLE_QUALITY",
                    name: "Improper PR Title",
                    passed: prTitleWords >= 10 && !lazyMessages.some(msg => prTitleLower === msg || prTitleLower.includes(`only ${msg}`)),
                    severity: "low",
                    errorDetail: `PR Title \`${pull_request.title}\` is too generic or short (Words: ${prTitleWords}). Minimum 10 words required.`,
                    successMsg: `${sender} has updated the pull request title and it follows the Kore SOP.`
                }
            ];

            // --- EVALUATE AND PERSIST INDIVIDUAL RULES ---
            for (const rule of sopRules) {
                console.log(`Checking Rule: ${rule.name} | Passed: ${rule.passed}`);
                if (!rule.passed) {
                    // Fail: Ensure failed entry exists
                    const [failure, created] = await DB.sopGuard.findOrCreate({
                        where: { workspaceId, prId, branchName, reason: rule.name, status: 'failed' },
                        defaults: {
                            workspaceRepoId: workspaceRepo.id,
                            triggeredBy: sender,
                            reason: rule.name,
                            error: rule.errorDetail,
                            severity: rule.severity,
                            status: 'failed'
                        }
                    });

                    if (!created) {
                        // Update existing failure with latest error detail
                        await failure.update({ error: rule.errorDetail });
                    }
                } else {
                    // Pass: If there's an existing failure for THIS rule, resolve it
                    const existingFailure = await DB.sopGuard.findOne({
                        where: { workspaceId, prId, reason: rule.name, status: 'failed' }
                    });

                    if (existingFailure) {
                        console.log(`Resolving previously failed rule: ${rule.name}`);
                        justificationMessage = rule.successMsg; // Capture the specific fix rationale
                        await existingFailure.update({
                            status: 'passed',
                            justification: rule.successMsg,
                            reason: `Resolved: ${rule.name}` // Labeling as resolved
                        });

                        // --- CREATE DECISION LOG FOR EACH SPECIFIC RESOLUTION ---
                        const resolutionTask = matchedTask?.key || "General Alignment";
                        const [resLog, resCreated] = await DB.decisionLogs.findOrCreate({
                            where: {
                                workspaceId,
                                sopGuardId: existingFailure.id
                            },
                            defaults: {
                                workspaceId,
                                title: `SOP Resolved: ${rule.name}`,
                                rationale: `PR Resolution for ${resolutionTask}: ${rule.successMsg}`,
                                linkedPrId: prId,
                                linkedJiraId: resolutionTask,
                                sopGuardId: existingFailure.id,
                                category: "architecture"
                            }
                        });

                        if (!resCreated) {
                            await resLog.update({ rationale: `PR Updated: ${rule.successMsg}` });
                        }
                    }
                }
            }

            // --- FINAL AGGREGATE SUCCESS CHECK (Entire PR) ---
            const remainingFailures = await DB.sopGuard.count({
                where: { workspaceId, prId, status: 'failed' }
            });

            console.log(`Final Evaluation - Remaining Failures: ${remainingFailures} | Matched Task: ${matchedTask?.key || 'None'}`);

            // If ALL clear, record the final alignment record
            if (remainingFailures === 0) {
                console.log("SUCCESS: All SOP guards cleared for PR.");
                const taskKey = matchedTask?.key || "General Alignment";

                await DB.sopGuard.findOrCreate({
                    where: { workspaceId, prId, status: 'passed', reason: "Policy Alignment Verified" },
                    defaults: {
                        workspaceRepoId: workspaceRepo.id,
                        branchName,
                        triggeredBy: sender,
                        jiraTaskIds: taskKey,
                        status: 'passed'
                    }
                });
            }

            // Vector Integration (Knowledge Graph Sync)
            try {
                const prContent = `PR #${pull_request.number}: ${pull_request.title}. \nDescription: ${pull_request.body || ''}`;
                // const embedding = await generateEmbedding(prContent);

                // const [contextNode, nodeCreated] = await DB.contextNodes.findOrCreate({
                //     where: { workspaceId, type: "github", "metadata.prId": prId },
                //     defaults: {
                //         content: prContent,
                //         metadata: { prId, repoFullName, branchName, author: sender },
                //         embedding
                //     }
                // });

                // if (!nodeCreated) {
                //     await contextNode.update({ content: prContent, embedding });
                // }

                if (matchedTask) {
                    const jiraNode = await DB.contextNodes.findOne({
                        where: { workspaceId, type: 'jira', metadata: { key: matchedTask.key } }
                    });

                    if (jiraNode) {
                        await DB.relationships.findOrCreate({
                            where: { sourceNodeId: contextNode.id, targetNodeId: jiraNode.id },
                            defaults: { workspaceId, relationshipType: 'implemented_by' }
                        });
                    }
                }
            } catch (memErr) {
                console.error("Vectorization Error:", memErr.message);
            }
        }

        return res.status(200).json({ status: 'ignored_event', event });
    } catch (err) {
        console.error("Webhook Error: ", err.message);
        return res.status(500).json({ error: err.message });
    }
};

export default HandleGithubWebhook;
