import axios from "axios";
import DB from "../../database";

const JiraCallback = async (req, res) => {
  const appLink = process.env.APP_LINK || "http://localhost:3000";
  try {
    const { code, state, error, error_description } = req.query;

    if (!code || !state) {
      const msg = encodeURIComponent(error_description || error || "Authorization cancelled");
      return res.redirect(`${appLink}/app/settings?tab=integrations&success=false&message=${msg}`);
    }

    const { userId } = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
    const clientId = process.env.JIRA_CLIENT_ID;
    const clientSecret = process.env.JIRA_CLIENT_SECRET;
    const redirectUri = process.env.JIRA_REDIRECT_URI || "http://localhost:5400/api/v1/integrations/jira/callback";

    let accessToken = null;
    let refreshToken = null;

    if (clientId && clientSecret) {
      const response = await axios.post("https://auth.atlassian.com/oauth/token", {
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri
      }, { headers: { "Content-Type": "application/json" } });

      console.log("Jira OAuth Response Data:", response.data);
      accessToken = response.data.access_token || accessToken;
      refreshToken = response.data.refresh_token || refreshToken;
    }

    if (!accessToken) {
      throw new Error("Failed to secure access token from Jira");
    }

    let integration = await DB.integrations.findOne({ where: { userId, type: "jira" } });
    if (integration) {
      integration.accessToken = accessToken;
      if (refreshToken) integration.refreshToken = refreshToken;
      await integration.save();
    } else {
      await DB.integrations.create({ type: "jira", accessToken, refreshToken, userId });
    }

    return res.redirect(`${appLink}/app/settings?tab=integrations&success=true&message=Jira connected successfully`);
  } catch (err) {
    console.error("Jira Callback Error:", err.response?.data || err.message);
    const errorMsg = encodeURIComponent(err.response?.data?.error_description || err.message || "Failed to connect Jira");
    return res.redirect(`${appLink}/app/settings?tab=integrations&success=false&message=${errorMsg}`);
  }
};

export default JiraCallback;
