import DB from "../../database";

const AssignWorkspaceRepo = async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId, selectedRepos } = req.body; 

    if (!workspaceId || !Array.isArray(selectedRepos)) {
      return res.status(400).json({ message: "workspaceId and an array of selectedRepos are required" });
    }

    const workspace = await DB.workspaces.findOne({ where: { id: workspaceId, userId } });
    if (!workspace) {
      return res.status(403).json({ message: "Only the workspace owner can assign repositories" });
    }

    const selectedRepoIds = selectedRepos.map(r => String(r.repoId));
    await DB.workspaceRepos.destroy({
      where: {
        workspaceId,
        repoId: { [DB.Sequelize.Op.notIn]: selectedRepoIds }
      }
    });

    if (selectedRepos.length > 0) {
      const workspaceRepoData = selectedRepos.map(repo => ({
        workspaceId,
        repoId: String(repo.repoId),
        repoFullName: repo.repoFullName,
        assignedBy: userId,
      }));

      await DB.workspaceRepos.bulkCreate(workspaceRepoData, {
        updateOnDuplicate: ["repoFullName", "assignedBy"]
      });
    }

    return res.status(200).json({ message: "Repositories successfully linked to workspace", count: selectedRepos.length });
  } catch (err) {
    console.error("AssignWorkspaceRepo Error:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

export default AssignWorkspaceRepo;
