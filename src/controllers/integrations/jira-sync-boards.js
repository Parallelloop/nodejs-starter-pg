import DB from "../../database";
import { getJiraCloudId, fetchJiraBoards, refreshJiraToken } from "../../utils/jira";

const SyncJiraBoards = async (req, res) => {
  try {
    const userId = req.user.id;
    let integration = await DB.integrations.findOne({ where: { userId, type: "jira" } });

    if (!integration || !integration.accessToken) {
      return res.status(404).json({ message: "Jira integration not connected" });
    }

    let accessToken = integration.accessToken;
    let cloudId;
    let boards;

    try {
      cloudId = await getJiraCloudId(accessToken);
      if (!cloudId) throw new Error("No cloud ID found");
      boards = await fetchJiraBoards(accessToken, cloudId);
    } catch (e) {
      if (e.message === "401" || e.message === "No cloud ID found") {
        console.log("Jira Access Token expired during board sync. Attempting refresh...");
        try {
          accessToken = await refreshJiraToken(integration);
          cloudId = await getJiraCloudId(accessToken);
          if (!cloudId) {
            return res.status(400).json({ message: "Could not find accessible Jira resources" });
          }
          boards = await fetchJiraBoards(accessToken, cloudId);
        } catch (refreshErr) {
          console.error("Jira token refresh failed during board sync:", refreshErr.message);
          return res.status(401).json({ message: "Jira session expired. Please reconnect." });
        }
      } else {
        throw e;
      }
    }

    console.log(`Syncing ${boards.length} Jira boards for user ${userId}`);

    const boardData = boards.map(b => ({
      boardId: b.id.toString(),
      name: b.name,
      type: b.type,
      userId,
    }));

    await DB.jiraBoards.bulkCreate(boardData, {
      updateOnDuplicate: ["name", "type"]
    });

    const allBoards = await DB.jiraBoards.findAll({ where: { userId } });
    return res.status(200).json({ message: "Boards synced successfully", boards: allBoards });
  } catch (err) {
    console.error("SyncJiraBoards Error:", err.response?.data || err.message);
    return res.status(500).json({ message: err.message });
  }
};

export default SyncJiraBoards;
