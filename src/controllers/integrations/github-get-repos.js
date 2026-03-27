import DB from "../../database";

const GetGitHubRepos = async (req, res) => {
  try {
    const userId = req.user.id;
    const repos = await DB.githubRepos.findAll({ where: { userId } });
    return res.status(200).json(repos);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export default GetGitHubRepos;
