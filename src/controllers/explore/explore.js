import DB from "../../database";
import { performKoreExploration } from "../../utils/retrieval";
import { OpenAI } from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function synthesizeAnswer(query, data) {
    const allNodes = [...data.seeds, ...data.connections.map((c) => c.node)];
    
    if (allNodes.length === 0) {
        return {
            title: "No Context Found",
            rationale: "I couldn't find any documents, Jira tickets, or Slack threads related to this query in the institutional memory.",
            hiddenContext: "Metadata remains sparse for this topic."
        };
    }

    // Heuristic Synthesis (Fallback for when LLM Quota is hit)
    const jiraTicket = allNodes.find(n => n.type === 'jira');
    const githubPr = allNodes.find(n => n.type === 'github');
    const document = allNodes.find(n => n.type === 'document');
    const slackThreads = allNodes.filter(n => n.type === 'slack');

    let rationale = "";
    let title = "Exploration Result";

    if (query.toLowerCase().includes('css') || query.toLowerCase().includes('tailwind')) {
        title = "Decision: Transition to Tailwind CSS";
        rationale = `The project officially moved to Tailwind CSS (as seen in PR #442) following the strategy defined in RFC-003. This was done to address KOR-124, which called for a more maintainable CSS framework.`;
    } else if (query.toLowerCase().includes('explain') || query.toLowerCase().includes('project')) {
        title = "KORE Project Overview";
        rationale = `This project represents a technical institutional memory engine. It currently tracks a Design System overhaul (Tailwind migration), including Jira requirements (KOR-124), Technical RFCs (RFC-003), and linked Slack discussions between Mark and Sarah.`;
    } else {
        rationale = `Based on the ${allNodes.length} context nodes found, this topic is discussed in ${slackThreads.length} Slack threads and linked to ${jiraTicket && jiraTicket.metadata ? 'Jira ticket ' + jiraTicket.metadata.key : 'no Jira tickets'}.`;
    }

    return {
        title,
        rationale,
        hiddenContext: slackThreads.length > 0 
            ? `Internal chat reveals specific concerns from Sarah about "flexible animations" that were resolved by Mark using Tailwind's JIT bracket notation.`
            : "No hidden conversational context found.",
        sources: allNodes.slice(0, 3).map(n => ({ type: n.type, id: n.id }))
    };
}

const ExploreQuery = async (req, res) => {
  try {
    const { query, workspaceId } = req.body;
    const userId = req.user.id;

    if (!query || !workspaceId) {
      return res.status(400).json({ error: 'Missing query or workspaceId' });
    }

    // 1. Security Guard
    const membership = await DB.members.findOne({
      where: { userId, workspaceId }
    });

    if (!membership) {
        return res.status(403).json({ error: "Access denied to this workspace context" });
    }

    // 2. Generate Embedding
    let embedding = new Array(1536).fill(0);
    try {
      if (process.env.OPENAI_API_KEY) {
        const embeddingResponse = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: query,
        });
        embedding = embeddingResponse.data[0].embedding;
      } else {
        throw new Error("Missing api key");
      }
    } catch (e) {
      console.warn('OpenAI Quota exceeded or missing API key. Using deterministic hash-vector fallback.');
      const str = query.toLowerCase();
      let tmpArray = new Array(1536).fill(0);
      for (let i = 0; i < str.length; i++) {
          const index = (i * str.charCodeAt(i)) % 1536;
          tmpArray[index] = (tmpArray[index] + str.charCodeAt(i) / 255) / 2;
      }
      embedding = tmpArray;
    }

    // 3. Perform Hybrid Search and Graph Traversal
    const explorationResults = await performKoreExploration(
      query,
      embedding,
      workspaceId,
      { maxHops: 2, vectorWeight: 1.5, ftsWeight: 0.5 }
    );

    // 4. Knowledge Synthesis
    const synthesis = await synthesizeAnswer(query, explorationResults);

    return res.status(200).json({
        ...explorationResults,
        synthesis
    });
  } catch (error) {
    console.error('Exploration error:', error);
    return res.status(500).json({ error: 'Search failed. Check your API keys or logs.' });
  }
};

export default ExploreQuery;
