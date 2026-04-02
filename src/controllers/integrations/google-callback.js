import axios from "axios";
import DB from "../../database";
import { v4 as uuidv4 } from "uuid";

const GoogleCallback = async (req, res) => {
  const appLink = process.env.APP_LINK || "http://localhost:3000";
  try {
    const { code, state, error } = req.query;

    if (error || !code || !state) {
      const errorMsg = encodeURIComponent(error || "Authorization cancelled");
      return res.redirect(`${appLink}/app/settings?tab=integrations&success=false&message=${errorMsg}`);
    }

    const { userId } = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    const response = await axios.post("https://oauth2.googleapis.com/token", {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });

    const { access_token, refresh_token } = response.data;

    let integration = await DB.integrations.findOne({ where: { userId, type: "google" } });
    if (integration) {
      integration.accessToken = access_token;
      if (refresh_token) integration.refreshToken = refresh_token;
      await integration.save();
    } else {
      integration = await DB.integrations.create({ 
        type: "google", 
        accessToken: access_token, 
        refreshToken: refresh_token || null, 
        userId 
      });
    }

    return res.redirect(`${appLink}/app/settings?tab=integrations&success=true&message=Google connected successfully`);
  } catch (err) {
    console.error("Google Callback Error:", err.response?.data || err.message);
    const errorMsg = encodeURIComponent(err.response?.data?.error_description || err.message || "Failed to connect Google");
    return res.redirect(`${appLink}/app/settings?tab=integrations&success=false&message=${errorMsg}`);
  }
};

export default GoogleCallback;
