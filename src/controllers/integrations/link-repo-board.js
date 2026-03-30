import DB from "../../database";

const LinkRepoBoard = async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId, repoId, boardIds } = req.body;

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

    if (Array.isArray(boardIds)) {
      // Fetch the boards to ensure they belong to the user
      const userBoards = await DB.jiraBoards.findAll({
        where: { id: boardIds, userId }
      });

      // Simple implementation: clear existing associations and set new ones
      await DB.workspaceRepoBoards.destroy({
        where: { workspaceRepoId: wsRepo.id }
      });

      if (userBoards.length > 0) {
        const links = userBoards.map(board => ({
          workspaceRepoId: wsRepo.id,
          jiraBoardId: board.id
        }));
        await DB.workspaceRepoBoards.bulkCreate(links);
      }
    }

    // Reload with associated workspaceRepoBoards
    const updatedRepo = await DB.workspaceRepos.findOne({
      where: { id: wsRepo.id },
      include: [{ 
        model: DB.workspaceRepoBoards, 
        as: "workspaceRepoBoards",
        include: [{ model: DB.jiraBoards, as: "jiraBoard" }]
      }]
    });

    return res.status(200).json({ 
      message: "Boards linked to repository successfully", 
      wsRepo: updatedRepo 
    });
  } catch (err) {
    console.error("LinkRepoBoard Error:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

export default LinkRepoBoard;
