import { launchBot, leaveBot, activeBotSessions } from '../utils/google-bot';
import { v4 as uuidv4 } from 'uuid';

export const startBot = async (req, res) => {
  try {
    const { meetingUrl, sessionId: providedSessionId } = req.body;
    
    if (!meetingUrl) {
      return res.status(400).json({ error: 'meetingUrl is required' });
    }

    const sessionId = providedSessionId || uuidv4();
    
    if (activeBotSessions.has(sessionId)) {
      return res.status(400).json({ error: 'Session ID already active' });
    }

    console.log(`[BotController] Launching bot for session ${sessionId}...`);
    
    // Launch async using functional launchBot
    launchBot(meetingUrl, sessionId).catch(err => {
      console.error(`[BotController] Error in launchBot():`, err.message);
      activeBotSessions.delete(sessionId);
    });

    return res.status(200).json({ 
      success: true,
      message: 'Kore Note Taker starting...', 
      sessionId,
      botName: 'Kore Note Taker'
    });
  } catch (err) {
    console.error("Bot Start Controller Error:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const stopBot = async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const session = activeBotSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'No active session found for ID' });
    }

    await leaveBot(sessionId);
    return res.status(200).json({ success: true, message: 'Bot stop command sent.' });
  } catch (err) {
    console.error("Bot Stop Controller Error:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getStatus = (req, res) => {
  const sessions = [];
  activeBotSessions.forEach((session, id) => {
    sessions.push({
      sessionId: id,
      meetingUrl: session.meetingUrl,
      isRunning: session.isRunning,
      captionCount: session.captions.length
    });
  });

  return res.status(200).json({ 
    success: true,
    activeSessions: sessions.length,
    sessions 
  });
};
