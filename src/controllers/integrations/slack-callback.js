import axios from "axios";
import DB from "../../database";

const SlackCallback = async (req, res) => {
  const appLink = process.env.APP_LINK || "http://localhost:3000";
  try {
    const { code, state, error, error_description } = req.query;
    const msg = error_description || error;

    if (error || !code || !state) {
      const errorMsg = encodeURIComponent(msg || "Authorization cancelled");
      return res.redirect(`${appLink}/app/settings?tab=integrations&success=false&message=${errorMsg}`);
    }

    const { userId } = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;

    let accessToken = null;
    let refreshToken = null;

    if (clientId && clientSecret) {
      const response = await axios.post("https://slack.com/api/oauth.v2.access", null, {
        params: { client_id: clientId, client_secret: clientSecret, code }
      });

      console.log("Slack OAuth Response Data:", response.data);
      if (response.data.ok) {
        accessToken = response.data.access_token;
        refreshToken = response.data.refresh_token || null;
      }
    }

    if (!accessToken) {
      throw new Error("Failed to secure access token from Slack");
    }

    let integration = await DB.integrations.findOne({ where: { userId, type: "slack" } });
    if (integration) {
      integration.accessToken = accessToken;
      if (refreshToken) integration.refreshToken = refreshToken;
      await integration.save();
    } else {
      await DB.integrations.create({ type: "slack", accessToken, refreshToken, userId });
    }

    return res.redirect(`${appLink}/app/settings?tab=integrations&success=true&message=Slack connected successfully`);
  } catch (err) {
    console.error("Slack Callback Error:", err.response?.data || err.message);
    const errorMsg = encodeURIComponent(err.response?.data?.error_description || err.message || "Failed to connect Slack");
    return res.redirect(`${appLink}/app/settings?tab=integrations&success=false&message=${errorMsg}`);
  }
};

export default SlackCallback;
