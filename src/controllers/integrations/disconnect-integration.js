import axios from "axios";
import DB from "../../database";

const DisconnectIntegration = async (req, res) => {
  try {
    const { type } = req.body;
    const userId = req.user.id;

    if (!type) {
      return res.status(400).json({ error: "Integration type is required" });
    }

    const integration = await DB.integrations.findOne({ where: { userId, type } });

    if (!integration) {
      return res.status(404).json({ error: "Integration not found" });
    }

    const { accessToken } = integration;

    // Optional: Revoke token from the provider
    try {
      if (type === "github") {
        const clientId = process.env.GITHUB_CLIENT_ID;
        const clientSecret = process.env.GITHUB_CLIENT_SECRET;
        if (clientId && clientSecret) {
          const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
          await axios.delete(`https://api.github.com/applications/${clientId}/token`, {
            data: { access_token: accessToken },
            headers: {
              Authorization: `Basic ${auth}`,
              Accept: "application/vnd.github.v3+json",
            },
          });
        }
      } else if (type === "slack") {
        // Leave all channels before revoking the token
        const userChannels = await DB.slackChannels.findAll({ where: { userId } });
        for (const channel of userChannels) {
          try {
            await axios.post("https://slack.com/api/conversations.leave", null, {
              params: { channel: channel.channelId },
              headers: { Authorization: `Bearer ${accessToken}` }
            });
          } catch (e) {
            // Already left or permission issue, skip
          }
        }
        await axios.post("https://slack.com/api/auth.revoke", null, {
          params: { token: accessToken },
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } else if (type === "jira") {
        const clientId = process.env.JIRA_CLIENT_ID;
        const clientSecret = process.env.JIRA_CLIENT_SECRET;
        if (clientId && clientSecret) {
          await axios.post("https://auth.atlassian.com/oauth/token/revoke", {
            client_id: clientId,
            client_secret: clientSecret,
            token: accessToken,
          });
        }
      }
    } catch (revokeError) {
      console.error(`Token revocation failed for ${type}:`, revokeError.response?.data || revokeError.message);
      // We still delete the record even if revocation fails (token might be expired)
    }

    await integration.destroy();

    return res.status(200).json({ message: `${type} integration disconnected successfully` });
  } catch (err) {
    console.error("Disconnect Integration Error:", err.message);
    return res.status(500).json({ error: "Failed to disconnect integration" });
  }
};

export default DisconnectIntegration;
