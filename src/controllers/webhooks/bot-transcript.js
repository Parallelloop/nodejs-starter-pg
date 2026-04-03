import DB from "../../database";

const HandleBotTranscript = async (req, res) => {
  try {
    const { sessionId, conversation, endedAt, isLive, captions } = req.body;
    
    if (isLive) {
      console.log(`[BotTranscript] Received live fragment for session ${sessionId}:`, captions.map(c => `[${c.speaker}] ${c.text}`).join(' | '));
      return res.status(200).send('Live update processed.');
    }

    console.log(`\n--- FINAL MEETING DIALOG RECEIVED ---`);
    console.log(`Session ID: ${sessionId}`);
    console.log(`Duration:   Approx ${conversation?.length || 0} chars`);

    // Match session mtg-ID
    const meetingId = sessionId.startsWith('mtg-') ? sessionId.split('-')[1] : null;

    if (meetingId) {
      const meeting = await DB.meetings.findByPk(meetingId);
      if (meeting) {
        meeting.status = 'ended';
        meeting.conversation = conversation; // Store the whole conversation dialog
        meeting.endedAt = new Date(endedAt);
        await meeting.save();
        console.log(`=> Meeting #${meetingId} saved with complete conversation transcription.`);
      }
    }

    return res.status(200).send('OK');
  } catch (err) {
    console.error("Bot Transcript Webhook Error:", err.message);
    return res.status(500).send('Webhook Processing Error');
  }
};

export default HandleBotTranscript;
