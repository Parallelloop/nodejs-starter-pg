import { leaveBot } from "../../utils/google-bot";

const GoogleBotStop = async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    await leaveBot(sessionId);
    return res.status(200).json({ success: true, message: "Bot leave command sent." });
  } catch (err) {
    console.error("Google Bot Stop Error:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export default GoogleBotStop;
