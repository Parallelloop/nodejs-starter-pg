const SlackAuth = (req, res) => {
  const userId = req.user.id;
  const clientId = process.env.SLACK_CLIENT_ID || "mock_slack_client_id";
  const redirectUri = process.env.SLACK_REDIRECT_URI || "http://localhost:5400/api/v1/integrations/slack/callback";

  const state = Buffer.from(JSON.stringify({ userId })).toString("base64");
  const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=channels:history,groups:history,im:history,mpim:history,users:read,team:read,channels:read,groups:read&user_scope=identify&redirect_uri=${redirectUri}&state=${state}`;

  return res.status(200).json({ url: authUrl });
};

export default SlackAuth;
