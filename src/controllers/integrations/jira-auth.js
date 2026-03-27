const JiraAuth = (req, res) => {
  const userId = req.user.id;
  const clientId = process.env.JIRA_CLIENT_ID || "mock_jira_client_id";
  const redirectUri = process.env.JIRA_REDIRECT_URI || "http://localhost:5400/api/v1/integrations/jira/callback";

  const state = Buffer.from(JSON.stringify({ userId })).toString("base64");
  const authUrl = `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${clientId}&scope=offline_access%20read%3Ajira-work%20manage%3Ajira-project%20manage%3Ajira-configuration%20read%3Ajira-user&redirect_uri=${redirectUri}&state=${state}&response_type=code&prompt=consent`;

  return res.status(200).json({ url: authUrl });
};

export default JiraAuth;
