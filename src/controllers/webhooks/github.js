import DB from "../../database";
import { hybridSearch } from "../../utils/retrieval";

async function generateEmbedding(text) {
    let embedding = new Array(1536).fill(0);
    const str = text.toLowerCase();
    for (let i = 0; i < str.length; i++) {
        const index = (i * str.charCodeAt(i)) % 1536;
        embedding[index] = (embedding[index] + str.charCodeAt(i) / 255) / 2;
    }
    return embedding;
}

async function triggerSlackRequest(githubUser, message, workspaceId) {
    console.log(`[Slack Simulation] Sending DM to ${githubUser}: ${message}`);
}

async function linkPrToJira(prId, jiraId, workspaceId, confidence) {
    // Attempt logic to find node or create raw representations
    // For POC, we just insert the edge pretending the nodes exist
    // However, source/target must be integers now, not strings? 
    // Wait, in api-kore we made contextNodes return Sequelize INTEGER but let's just create nodes if they don't exist
    // to strictly preserve the relationships.
    
    let prNode = await DB.contextNodes.findOne({ where: { type: 'github', metadata: { prId } } });
    if (!prNode) {
         prNode = await DB.contextNodes.create({
            workspaceId,
            type: 'github',
            content: `PR ${prId}`,
            metadata: { prId },
            embedding: await generateEmbedding(`PR ${prId}`)
         });
    }

    let jiraNode = await DB.contextNodes.findOne({ where: { type: 'jira', metadata: { key: jiraId } } });
    if (!jiraNode) {
        jiraNode = await DB.contextNodes.create({
           workspaceId,
           type: 'jira',
           content: `Jira Ticket ${jiraId}`,
           metadata: { key: jiraId },
           embedding: await generateEmbedding(`Jira Ticket ${jiraId}`)
        });
    }

    await DB.relationships.create({
        workspaceId,
        sourceNodeId: prNode.id,
        targetNodeId: jiraNode.id,
        relationshipType: 'implemented_by',
        metadata: { confidence, source: 'webhook_pipeline' }
    });
}

const HandlePrMerge = async (req, res) => {
    try {
        const { pull_request, repository } = req.body;
        const workspaceId = req.query.workspaceId; // webhooks generally use query params or path for workspace binding

        if (!pull_request || !workspaceId) {
            return res.status(400).json({ error: "Missing payload or workspaceId" });
        }

        const prDescription = pull_request.body || "";
        const branchName = pull_request.head?.ref || "";
        const prId = pull_request.html_url;

        // 1. Extract Jira ID using Regex
        const jiraRegex = /[A-Z]+-[0-9]+/g;
        const matches = [...prDescription.matchAll(jiraRegex), ...branchName.matchAll(jiraRegex)];
        const jiraIds = Array.from(new Set(matches.map(m => m[0])));

        if (jiraIds.length > 0) {
            // High confidence: Link directly
            for (const jiraId of jiraIds) {
                await linkPrToJira(prId, jiraId, workspaceId, 1.0);
            }
            return res.status(200).json({ status: 'linked_direct', jiraIds });
        }

        // 2. Fallback: Semantic search for candidate tickets
        const prEmbedding = await generateEmbedding(prDescription); 
        
        // Search contextNodes
        const candidates = await hybridSearch(
            prDescription, 
            prEmbedding, 
            workspaceId, 
            { limit: 3 }
        );

        const topMatch = candidates.find(c => c.type === 'jira');
        const confidence = topMatch ? (topMatch.rankScore || 0) : 0;

        // Arbitrary threshold for POC
        if (confidence < 0.7) {
            // 4. Trigger Slack DM request
            await triggerSlackRequest(
                pull_request.user?.login || 'unknown',
                `Hey! You just merged PR #${pull_request.number}, but I couldn't find a matching Jira ticket. Was it for KOR-XXX?`,
                workspaceId
            );
            return res.status(200).json({ status: 'slack_request_sent' });
        }

        // 5. Link with confidence
        if (topMatch) {
            await linkPrToJira(prId, topMatch.metadata?.key || `ticket-${topMatch.id}`, workspaceId, confidence);
            return res.status(200).json({ status: 'linked_semantic', candidateId: topMatch.id });
        }

        return res.status(200).json({ status: 'no_match_found' });
    } catch (err) {
        console.error("Webhook processing error: ", err);
        return res.status(500).json({ error: err.message });
    }
};

export default HandlePrMerge;
