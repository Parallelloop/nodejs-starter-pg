import DB from "../../database";

/**
 * Fetches all Decision Logs for a workspace
 */
export const GetDecisions = async (req, res) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) return res.status(400).json({ error: "workspaceId is required" });

    // Ensure user has access to workspace
    const member = await DB.members.findOne({ where: { workspaceId, userId: req.user.id } });
    if (!member) return res.status(403).json({ error: "Access denied" });

    const decisions = await DB.decisionLogs.findAll({
      where: { workspaceId },
      include: [
        { model: DB.users, as: "user", attributes: ["firstName", "lastName"] },
        {
          model: DB.sopGuard,
          as: "sopGuard",
          include: [{ model: DB.users, as: "user", attributes: ["firstName", "lastName"] }]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    // Transform for UI ( Institutional Memory Bank )
    const transformed = decisions.map((d) => {
      const prIdRaw = d.linkedPrId || d.sopGuard?.prId || "";
      const commitIdRaw = d.sopGuard?.commitId || "";
      
      const prNum = prIdRaw.split('/').pop() || "";
      const commitHash = commitIdRaw.split('/').pop()?.substring(0, 6) || "";

      const prBadge = (prNum && !isNaN(Number(prNum))) ? `#${prNum}` : null;
      const commitBadge = commitHash ? commitHash : null;

      const author = d.user || d.sopGuard?.user;
      const authorName = author 
        ? `${author.firstName} ${author.lastName}` 
        : "System";

      return {
        id: String(d.id),
        title: d.title,
        rationale: d.rationale,
        author: { 
          name: authorName, 
          initials: authorName.split(' ').map(n => n[0]).join('') 
        },
        date: new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        category: d.category || "architecture",
        confidence: 100,
        verified: true,
        prBadge,
        commitBadge,
        prId: prIdRaw,
        commitId: commitIdRaw,
        triggeredBy: d.sopGuard?.triggeredBy,
        doneBy: authorName, 
        sources: [
          { type: "github", label: prBadge || commitBadge || "Webhook" },
          ...(d.linkedJiraId ? [{ type: "jira", label: d.linkedJiraId }] : [])
        ]
      };
    });

    return res.status(200).json(transformed);
  } catch (err) {
    console.error("GetDecisions Error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Fetches SOP failures (Knowledge Gaps) for a workspace
 */
export const GetKnowledgeGaps = async (req, res) => {
  try {
    const { workspaceId, status } = req.query;
    if (!workspaceId) return res.status(400).json({ error: "workspaceId is required" });

    const whereClause = { workspaceId };
    if (status) {
        whereClause.status = status;
    } else {
        whereClause.status = "failed";
    }

    const gaps = await DB.sopGuard.findAll({
      where: whereClause,
      include: [{ model: DB.users, as: "user", attributes: ["firstName", "lastName"] }],
      order: [["createdAt", "DESC"]]
    });

    const transformed = gaps.map((g) => {
        const timeAgo = (date) => {
            const seconds = Math.floor((new Date() - new Date(date)) / 1000);
            if (seconds < 60) return `${seconds}s ago`;
            if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
            if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
            return `${Math.floor(seconds / 86400)}d ago`;
        };

        const prIdRaw = g.prId || "";
        const commitIdRaw = g.commitId || "";
        
        const prNum = prIdRaw.split('/').pop() || "";
        const commitHash = commitIdRaw.split('/').pop()?.substring(0, 6) || "";

        return {
            id: String(g.id),
            title: g.reason.split('.')[0],
            description: g.reason.split('.')[0], // support both mappings
            detail: g.reason,
            author: g.user ? `${g.user.firstName} ${g.user.lastName}` : "Pending",
            branch: g.branchName,
            time: timeAgo(g.createdAt),
            severity: g.severity || "low",
            prId: prIdRaw,
            prBadge: (prNum && !isNaN(Number(prNum))) ? `#${prNum}` : null,
            commitId: commitIdRaw,
            commitBadge: commitHash ? commitHash : null,
            branchName: g.branchName,
            justification: g.justification,
            doneBy: g.doneBy,
            triggeredBy: g.triggeredBy
        };
    });

    return res.status(200).json(transformed);
  } catch (err) {
    console.error("GetKnowledgeGaps Error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Updates SOP Guard with justification
 */
export const UpdateSopJustification = async (req, res) => {
  try {
    const { id } = req.params;
    const { justification, category } = req.body;

    const sop = await DB.sopGuard.findByPk(id);
    if (!sop) return res.status(404).json({ error: "SOP Guard not found" });

    const member = await DB.members.findOne({ where: { workspaceId: sop.workspaceId, userId: req.user.id } });
    if (!member) return res.status(403).json({ error: "Access denied" });

    await sop.update({
        justification,
        doneBy: req.user.id,
        status: 'passed' // Resolve the gap
    });

    // Create a corresponding Decision Log representing the Institutional Memory entry
    // We use findOrCreate keyed by sopGuardId to ensure each policy deviation is only documented once
    const [decisionLog, logCreated] = await DB.decisionLogs.findOrCreate({
        where: { sopGuardId: sop.id },
        defaults: {
            workspaceId: sop.workspaceId,
            title: `Architecture Justification: ${sop.reason.split('.')[0] || "Policy Deviation"}`,
            rationale: justification,
            category: category || "architecture",
            linkedPrId: sop.prId,
            sopGuardId: sop.id,
            userId: req.user.id
        }
    });

    // If the log already exists (e.g. from a previous justification draft), update the rationale
    if (!logCreated) {
        await decisionLog.update({
            rationale: justification,
            category: category || "architecture",
            userId: req.user.id
        });
    }

    return res.status(200).json(sop);
  } catch (err) {
    console.error("UpdateSopJustification Error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};
