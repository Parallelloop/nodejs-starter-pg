const JiraAuth = (req, res) => {
  const userId = req.user.id;
  const clientId = process.env.JIRA_CLIENT_ID || "mock_jira_client_id";
  const redirectUri = process.env.JIRA_REDIRECT_URI || "http://localhost:5400/api/v1/integrations/jira/callback";

  const state = Buffer.from(JSON.stringify({ userId })).toString("base64");
  const scopes = [
    "offline_access",
    "read:jira-work",
    "write:jira-work",
    "read:jira-user",
    "read:issue:jira",
    "read:issue-status:jira",
    "read:project:jira",
    "read:user:jira",
    "read:board-scope:jira-software",
    "read:issue:jira-software",
    "read:project:jira-software",
    "read:sprint:jira-software",
    "read:source-code:jira-software",
    "write:source-code:jira-software"
  ].join("%20");

  const authUrl = `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}&response_type=code&prompt=consent`;

  return res.status(200).json({ url: authUrl });
};

export default JiraAuth;
