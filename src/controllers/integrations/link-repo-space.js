import DB from "../../database";

const LinkRepoSpace = async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId, repoId, spaceIds } = req.body;

    if (!workspaceId || !repoId) {
      return res.status(400).json({ message: "workspaceId and repoId are required" });
    }

    // Check if workspace owner
    const workspace = await DB.workspaces.findOne({ where: { id: workspaceId, userId } });
    if (!workspace) {
      return res.status(403).json({ message: "Only the workspace owner can perform this action" });
    }

    // Find or create the workspace repo entry
    const [wsRepo] = await DB.workspaceRepos.findOrCreate({
      where: { workspaceId, repoId },
      defaults: { 
        workspaceId, 
        repoId, 
        repoFullName: req.body.repoFullName || "", 
        assignedBy: userId 
      }
    });

    if (Array.isArray(spaceIds)) {
      // Fetch the spaces to ensure they belong to the user
      const userSpaces = await DB.confluenceSpaces.findAll({
        where: { id: spaceIds, userId }
      });

      // Simple implementation: clear existing associations and set new ones
      await DB.workspaceRepoSpaces.destroy({
        where: { workspaceRepoId: wsRepo.id }
      });

      if (userSpaces.length > 0) {
        const links = userSpaces.map(space => ({
          workspaceRepoId: wsRepo.id,
          confluenceSpaceId: space.id
        }));
        await DB.workspaceRepoSpaces.bulkCreate(links);
      }
    }

    // Reload with associated workspaceRepoSpaces
    const updatedRepo = await DB.workspaceRepos.findOne({
      where: { id: wsRepo.id },
      include: [{ 
        model: DB.workspaceRepoSpaces, 
        as: "workspaceRepoSpaces",
        include: [{ model: DB.confluenceSpaces, as: "confluenceSpace" }]
      }]
    });

    return res.status(200).json({ 
      message: "Spaces linked to repository successfully", 
      wsRepo: updatedRepo 
    });
  } catch (err) {
    console.error("LinkRepoSpace Error:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

export default LinkRepoSpace;
