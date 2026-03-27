import axios from "axios";
import DB from "../../database";

const SyncSlackChannels = async (req, res) => {
  try {
    const userId = req.user.id;
    const integration = await DB.integrations.findOne({ where: { userId, type: "slack" } });

    if (!integration || !integration.accessToken) {
      return res.status(404).json({ message: "Slack integration not connected" });
    }

    // Fetch public and private channels
    // Requires channels:read, groups:read scopes
    const response = await axios.get("https://slack.com/api/conversations.list", {
      headers: { Authorization: `Bearer ${integration.accessToken}` },
      params: { 
        types: "public_channel,private_channel",
        limit: 1000 
      }
    });

    if (!response.data.ok) {
      throw new Error(response.data.error || "Failed to fetch Slack channels");
    }

    const channels = response.data.channels;
    console.log(`Syncing ${channels.length} Slack channels for user ${userId}`);

    const channelData = channels.map(ch => ({
      channelId: ch.id,
      name: ch.name,
      isPrivate: ch.is_private || false,
      userId,
    }));

    await DB.slackChannels.bulkCreate(channelData, {
      updateOnDuplicate: ["name", "isPrivate"]
    });

    const allChannels = await DB.slackChannels.findAll({ where: { userId } });
    return res.status(200).json({ message: "Channels synced successfully", channels: allChannels });
  } catch (err) {
    console.error("SyncSlackChannels Error:", err.response?.data || err.message);
    return res.status(500).json({ message: err.message });
  }
};

export default SyncSlackChannels;
