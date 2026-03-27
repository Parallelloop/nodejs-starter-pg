import axios from "axios";
import DB from "../../database";
import NodeCache from "node-cache";

const statsCache = new NodeCache({ stdTTL: 900, checkperiod: 60 });

const extractTotalFromLink = (linkHeader) => {
  if (!linkHeader) return 0;
  const match = linkHeader.match(/page=(\d+)>; rel="last"/);
  return match ? parseInt(match[1]) : 0;
};

const GetGitHubRepoStats = async (req, res) => {
  try {
    const requesterId = req.user.id;
    const { repoFullName, workspaceId, refresh } = req.query;

    if (!repoFullName || !workspaceId) {
      return res.status(400).json({ message: "repoFullName and workspaceId are required" });
    }

    // 1. Verify access to workspace & get ownerId
    const workspace = await DB.workspaces.findByPk(workspaceId);
    if (!workspace) return res.status(404).json({ message: "Workspace not found" });

    // Check if user is owner of workspace or a member
    const isOwner = workspace.userId === requesterId;
    let isMember = false;
    
    if (!isOwner) {
       const memberRecord = await DB.members.findOne({ where: { workspaceId, userId: requesterId } });
       if (memberRecord) isMember = true;
    }

    if (!isOwner && !isMember) {
       return res.status(403).json({ message: "You don't have access to this workspace's repositories." });
    }

    // 2. Client-side caching at workspace level
    const cacheKey = `ws:${workspaceId}:repo:${repoFullName}:full_stats`;
    const cachedData = statsCache.get(cacheKey);

    if (cachedData && refresh !== "true") {
      return res.status(200).json({ ...cachedData, source: "cache" });
    }

    // 3. Fetch GitHub integration for the workspace owner
    const ownerId = workspace.userId;
    const integration = await DB.integrations.findOne({ where: { userId: ownerId, type: "github" } });
    
    if (!integration || !integration.accessToken) {
      return res.status(404).json({ 
        message: "The workspace owner has not connected GitHub yet. Integration required for repo stats." 
      });
    }

    const headers = {
      Authorization: `Bearer ${integration.accessToken}`,
      Accept: "application/vnd.github.v3+json",
    };

    // Parallel fetch for speed
    const [commitsRes, prsRes, collaboratorsRes, totalCommitsRes] = await Promise.all([
      axios.get(`https://api.github.com/repos/${repoFullName}/commits?per_page=100`, { headers }).catch(() => ({ data: [] })),
      axios.get(`https://api.github.com/repos/${repoFullName}/pulls?state=all&per_page=100`, { headers }).catch(() => ({ data: [] })),
      axios.get(`https://api.github.com/repos/${repoFullName}/collaborators?per_page=100`, { headers }).catch(() => ({ data: [] })),
      axios.get(`https://api.github.com/repos/${repoFullName}/commits?per_page=1`, { headers }).catch(() => ({ headers: {} }))
    ]);

    const repoInfo = await DB.githubRepos.findOne({ where: { fullName: repoFullName, userId: ownerId } });
    const repoId = repoInfo ? repoInfo.repoId : "";

    const totalCommitsCount = extractTotalFromLink(totalCommitsRes.headers?.link) || (commitsRes.data.length > 0 ? commitsRes.data.length : 0);

    const statsData = {
      repoId,
      requesterId,
      isOwner,
      commits: (commitsRes.data || []).map(c => ({
        sha: c.sha,
        message: c.commit.message,
        author: c.commit.author.name,
        date: c.commit.author.date,
        avatar: c.author?.avatar_url
      })),
      totalCommits: totalCommitsCount,
      pullRequests: (prsRes.data || []).map(p => ({
        id: p.id,
        number: p.number,
        title: p.title,
        body: p.body,
        state: p.state,
        user: p.user.login,
        createdAt: p.created_at
      })),
      collaborators: (collaboratorsRes.data || []).map(collab => ({
        id: collab.id,
        login: collab.login,
        avatar: collab.avatar_url,
        type: collab.type
      }))
    };

    // Store in cache
    statsCache.set(cacheKey, statsData);

    return res.status(200).json({ ...statsData, source: "live" });
  } catch (err) {
    console.error("GetGitHubRepoStats Error:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

export default GetGitHubRepoStats;
