import axios from "axios";
import DB from "../../database";

const SyncGitHubRepos = async (req, res) => {
  try {
    const userId = req.user.id;

    const integration = await DB.integrations.findOne({ where: { userId, type: "github" } });
    if (!integration || !integration.accessToken) {
      return res.status(404).json({ message: "GitHub integration not connected" });
    }

    const response = await axios.get("https://api.github.com/user/repos?per_page=100&sort=updated", {
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    const repos = response.data;
    console.log(`Syncing ${repos.length} GitHub repos for user ${userId}`);

    const repoData = repos.map(repo => ({
      repoId: String(repo.id),
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      userId,
    }));

    await DB.githubRepos.bulkCreate(repoData, {
      updateOnDuplicate: ["name", "fullName", "private"]
    });

    const allRepos = await DB.githubRepos.findAll({ where: { userId } });
    return res.status(200).json({ message: "Repos synced successfully", repos: allRepos });
  } catch (err) {
    console.error("SyncGitHubRepos Error:", err.response?.data || err.message);
    return res.status(500).json({ message: err.message });
  }
};

export default SyncGitHubRepos;
