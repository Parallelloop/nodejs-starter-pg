import { activeBotSessions } from "../../utils/google-bot";

const GoogleBotStatus = async (req, res) => {
  try {
    const sessions = [];
    activeBotSessions.forEach((bot, id) => {
      sessions.push({
        sessionId: id,
        meetingUrl: bot.meetingUrl,
        isRunning: bot.isRunning,
        captionCount: bot.captions.length
      });
    });

    return res.status(200).json({ 
      success: true,
      activeSessions: sessions.length,
      sessions 
    });
  } catch (err) {
    console.error("Google Bot Status Error:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export default GoogleBotStatus;
