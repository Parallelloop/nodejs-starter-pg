import DB from "../../database";

const GitHubAuth = (req, res) => {
  const userId = req.user.id;
  const clientId = process.env.GITHUB_CLIENT_ID || "mock_github_client_id";
  const redirectUri = process.env.GITHUB_REDIRECT_URI || "http://localhost:5400/api/v1/integrations/github/callback";

  const state = Buffer.from(JSON.stringify({ userId })).toString("base64");
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo,user&state=${state}`;

  return res.status(200).json({ url: authUrl });
};

export default GitHubAuth;
