import DB from "../../database";
import { getConfluenceCloudId, fetchConfluenceSpaces, refreshJiraToken } from "../../utils/jira";

const SyncConfluenceSpaces = async (req, res) => {
  try {
    const userId = req.user.id;
    let integration = await DB.integrations.findOne({ where: { userId, type: "jira" } });

    if (!integration || !integration.accessToken) {
      return res.status(404).json({ message: "Jira/Confluence integration not connected" });
    }

    let accessToken = integration.accessToken;
    let cloudId;
    let spaces;

    try {
      cloudId = await getConfluenceCloudId(accessToken);
      if (!cloudId) throw new Error("No cloud ID found");
      spaces = await fetchConfluenceSpaces(accessToken, cloudId);
    } catch (e) {
      if (e.message === "401" || e.message === "No cloud ID found") {
        console.log("Confluence Access Token expired during spaces sync. Attempting refresh...");
        try {
          accessToken = await refreshJiraToken(integration);
          cloudId = await getConfluenceCloudId(accessToken);
          if (!cloudId) {
            return res.status(400).json({ message: "Could not find accessible Confluence resources" });
          }
          spaces = await fetchConfluenceSpaces(accessToken, cloudId);
        } catch (refreshErr) {
          console.error("Confluence token refresh failed during space sync:", refreshErr.message);
          return res.status(401).json({ message: "Confluence session expired. Please reconnect." });
        }
      } else {
        throw e;
      }
    }

    console.log(`Syncing ${spaces.length} Confluence spaces for user ${userId}`);

    const spaceData = spaces.map(s => ({
      spaceId: s.id.toString(),
      name: s.title || "Untitled Document",
      key: s.type || "page",
      userId,
    }));

    await DB.confluenceSpaces.bulkCreate(spaceData, {
      updateOnDuplicate: ["name", "key"]
    });

    const allSpaces = await DB.confluenceSpaces.findAll({ where: { userId } });
    return res.status(200).json({ message: "Spaces synced successfully", spaces: allSpaces });
  } catch (err) {
    console.error("SyncConfluenceSpaces Error:", err.response?.data || err.message);
    return res.status(500).json({ message: err.message });
  }
};

export default SyncConfluenceSpaces;
