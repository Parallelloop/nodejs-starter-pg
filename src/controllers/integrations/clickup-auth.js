const ClickupAuth = (req, res) => {
  const userId = req.user.id;
  const clientId = process.env.CLICKUP_CLIENT_ID || "mock_clickup_client_id";
  const redirectUri = process.env.CLICKUP_REDIRECT_URI || "http://localhost:5400/api/v1/integrations/clickup/callback";

  const state = Buffer.from(JSON.stringify({ userId })).toString("base64");
  const authUrl = `https://app.clickup.com/api?client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}`;

  return res.status(200).json({ url: authUrl });
};

export default ClickupAuth;
