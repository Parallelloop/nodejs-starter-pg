import axios from "axios";

export async function fetchSlackMessages(accessToken, channelId, limit = 50) {
  try {
    const response = await axios.get("https://slack.com/api/conversations.history", {
      params: {
        channel: channelId,
        limit: limit,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.data.ok) {
      throw new Error(response.data.error || "Slack API error");
    }

    return response.data.messages || [];
  } catch (err) {
    console.error("Failed to fetch Slack messages:", err.message);
    return [];
  }
}
