import { launchBot, activeBotSessions } from "../../utils/google-bot";
import { v4 as uuidv4 } from "uuid";

const GoogleBotStart = async (req, res) => {
  try {
    const { meetingUrl, sessionId: providedSessionId } = req.body;
    
    if (!meetingUrl) {
      return res.status(400).json({ error: "meetingUrl is required" });
    }

    const sessionId = providedSessionId || uuidv4();
    
    if (activeBotSessions.has(sessionId)) {
      return res.status(400).json({ error: "Session ID already active" });
    }

    console.log(`[GoogleBotStart] Launching bot for session ${sessionId}...`);
    
    // Launch async using pure function
    launchBot(meetingUrl, sessionId).catch(err => {
      console.error(`[GoogleBotStart] Error in launchBot():`, err.message);
      activeBotSessions.delete(sessionId);
    });

    return res.status(200).json({ 
      success: true,
      message: "Kore Note Taker starting...", 
      sessionId
    });
  } catch (err) {
    console.error("Google Bot Start Error:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export default GoogleBotStart;
