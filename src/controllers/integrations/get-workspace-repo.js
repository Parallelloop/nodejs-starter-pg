import DB from "../../database";

const GetWorkspaceRepo = async (req, res) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) return res.status(400).json({ message: "workspaceId is required" });

    const workspaceRepos = await DB.workspaceRepos.findAll({ 
      where: { workspaceId },
      include: [
        { model: DB.slackChannels, as: "slackChannel" },
        { 
          model: DB.workspaceRepoBoards, 
          as: "workspaceRepoBoards",
          include: [{ model: DB.jiraBoards, as: "jiraBoard" }]
        },
        { 
          model: DB.workspaceRepoSpaces, 
          as: "workspaceRepoSpaces",
          include: [{ model: DB.confluenceSpaces, as: "confluenceSpace" }]
        }
      ]
    });
    return res.status(200).json(workspaceRepos || []);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export default GetWorkspaceRepo;
