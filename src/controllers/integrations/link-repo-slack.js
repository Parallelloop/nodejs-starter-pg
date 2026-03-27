import DB from "../../database";

const LinkRepoSlack = async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId, repoId, channelId } = req.body;

    if (!workspaceId || !repoId) {
      return res.status(400).json({ message: "workspaceId and repoId are required" });
    }

    // Check if workspace owner
    const workspace = await DB.workspaces.findOne({ where: { id: workspaceId, userId } });
    if (!workspace) {
      return res.status(403).json({ message: "Only the workspace owner can perform this action" });
    }

    const [wsRepo] = await DB.workspaceRepos.findOrCreate({
      where: { workspaceId, repoId },
      defaults: { 
        workspaceId, 
        repoId, 
        repoFullName: req.body.repoFullName || "", 
        assignedBy: userId 
      }
    });

    wsRepo.slackChannelId = channelId || null;
    await wsRepo.save();

    return res.status(200).json({ message: "Slack channel linked to repository successfully", wsRepo });
  } catch (err) {
    console.error("LinkRepoSlack Error:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

export default LinkRepoSlack;
