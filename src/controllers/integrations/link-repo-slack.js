import axios from "axios";
import DB from "../../database";

const LinkRepoSlack = async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId, repoId, channelId } = req.body;

    if (!workspaceId || !repoId) {
      return res.status(400).json({ message: "workspaceId and repoId are required" });
    }

    // Check if workspace owner
    const workspace = await DB.workspaces.findOne({ where: { id: workspaceId, userId } });
    if (!workspace) {
      return res.status(403).json({ message: "Only the workspace owner can perform this action" });
    }

    const [wsRepo] = await DB.workspaceRepos.findOrCreate({
      where: { workspaceId, repoId },
      defaults: { 
        workspaceId, 
        repoId, 
        repoFullName: req.body.repoFullName || "", 
        assignedBy: userId 
      }
    });

    if (channelId) {
      const slackChannel = await DB.slackChannels.findOne({ where: { id: channelId, userId } });
      if (!slackChannel) {
        return res.status(404).json({ message: "Slack channel not found. Please sync channels first." });
      }

      // --- MANDATORY SLACK BOT INVITATION ---
      const integration = await DB.integrations.findOne({ where: { userId, type: "slack" } });
      if (!integration || !integration.accessToken) {
        return res.status(403).json({ message: "Slack integration not found or disconnected. Bot cannot join." });
      }

      const joinResp = await axios.post("https://slack.com/api/conversations.join", null, {
        params: { channel: slackChannel.channelId },
        headers: { Authorization: `Bearer ${integration.accessToken}` }
      });
      
      if (!joinResp.data.ok) {
        return res.status(422).json({ 
          message: `KORE Bot failed to join the Slack channel: ${joinResp.data.error}. Please ensure the bot is added to the workspace and the channel is accessible.` 
        });
      }

      console.log(`Slack Bot successfully joined channel: ${slackChannel.name}`);
      wsRepo.slackChannelId = slackChannel.id;

    } else {
      // --- MANDATORY UNLINKING: AUTOMATIC SLACK BOT LEAVE ---
      if (wsRepo.slackChannelId) {
        const oldChannel = await DB.slackChannels.findByPk(wsRepo.slackChannelId);
        const integration = await DB.integrations.findOne({ where: { userId, type: "slack" } });
        
        if (oldChannel && integration && integration.accessToken) {
          const leaveResp = await axios.post("https://slack.com/api/conversations.leave", null, {
            params: { channel: oldChannel.channelId },
            headers: { Authorization: `Bearer ${integration.accessToken}` }
          });
          
          if (!leaveResp.data.ok) {
            // If already left, we can proceed. Otherwise, block the unlink.
            const harmlessErrors = ['not_in_channel', 'channel_not_found'];
            if (!harmlessErrors.includes(leaveResp.data.error)) {
              return res.status(422).json({ 
                message: `KORE Bot failed to leave the current channel: ${leaveResp.data.error}. Unlinking blocked to prevent ghost notifications.` 
              });
            }
          }
          console.log(`Slack Bot successfully left channel: ${oldChannel.name}`);
        }
      }
      wsRepo.slackChannelId = null;
    }

    await wsRepo.save();

    return res.status(200).json({ message: "Slack linkage updated successfully", wsRepo });
  } catch (err) {
    console.error("LinkRepoSlack Error:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

export default LinkRepoSlack;
