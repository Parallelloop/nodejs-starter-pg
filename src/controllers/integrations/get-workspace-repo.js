import DB from "../../database";

const GetWorkspaceRepo = async (req, res) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) return res.status(400).json({ message: "workspaceId is required" });

    const workspaceRepos = await DB.workspaceRepos.findAll({ where: { workspaceId } });
    return res.status(200).json(workspaceRepos || []);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export default GetWorkspaceRepo;
