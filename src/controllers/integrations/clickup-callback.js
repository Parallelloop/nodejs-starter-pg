import axios from "axios";
import DB from "../../database";

const ClickupCallback = async (req, res) => {
  const appLink = process.env.APP_LINK || "http://localhost:3000";
  try {
    const { code, state, error, error_description } = req.query;

    if (!code || !state) {
      const msg = encodeURIComponent(error_description || error || "Authorization cancelled");
      return res.redirect(`${appLink}/app/settings?tab=integrations&success=false&message=${msg}`);
    }

    const { userId } = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
    const clientId = process.env.CLICKUP_CLIENT_ID;
    const clientSecret = process.env.CLICKUP_CLIENT_SECRET;

    let accessToken = null;
    let refreshToken = null;

    if (clientId && clientSecret) {
      const response = await axios.post("https://app.clickup.com/api/v2/oauth/token", {
        client_id: clientId,
        client_secret: clientSecret,
        code
      });

      console.log("ClickUp OAuth Response Data:", response.data);
      accessToken = response.data.access_token || accessToken;
    }

    if (!accessToken) {
      throw new Error("Failed to secure access token from ClickUp");
    }

    let integration = await DB.integrations.findOne({ where: { userId, type: "clickup" } });
    if (integration) {
      integration.accessToken = accessToken;
      if (refreshToken) integration.refreshToken = refreshToken;
      await integration.save();
    } else {
      await DB.integrations.create({ type: "clickup", accessToken, refreshToken, userId });
    }

    return res.redirect(`${appLink}/app/settings?tab=integrations&success=true&message=ClickUp connected successfully`);
  } catch (err) {
    console.error("ClickUp Callback Error:", err.response?.data || err.message);
    const errorMsg = encodeURIComponent(err.response?.data?.error_description || err.message || "Failed to connect ClickUp");
    return res.redirect(`${appLink}/app/settings?tab=integrations&success=false&message=${errorMsg}`);
  }
};

export default ClickupCallback;
