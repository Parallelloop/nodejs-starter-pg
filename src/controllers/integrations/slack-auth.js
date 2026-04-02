const SlackAuth = (req, res) => {
  const userId = req.user.id;
  const clientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = process.env.SLACK_REDIRECT_URI;

  const state = Buffer.from(JSON.stringify({ userId })).toString("base64");

  // Re-aligned scopes based on actual Slack API requirements for joining/leaving/posting
  // Includes granular permissions: channels:join, chat:write, chat:write.public, groups:write
  const scopes = [
    "channels:history",
    "groups:history",
    "im:history",
    "mpim:history",
    "users:read",
    "team:read",
    "channels:read",
    "groups:read",
    "channels:join",
    "chat:write",
    "chat:write.public",
    "groups:write"
  ].join(",");

  const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&user_scope=identify&redirect_uri=${redirectUri}&state=${state}`;

  return res.status(200).json({ url: authUrl });
};

export default SlackAuth;
