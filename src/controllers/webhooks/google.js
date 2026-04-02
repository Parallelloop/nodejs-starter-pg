import DB from "../../database";
import axios from "axios";

/**
 * Handle Google Cloud Pub/Sub Push Notifications
 * Used for Google Workspace Events API (Google Meet lifecycle events)
 * 
 * Event Types Handled:
 *   - google.workspace.meet.conference.v2.started  → Meeting Started (first participant joined)
 *   - google.workspace.meet.conference.v2.ended    → Meeting Ended (all participants left)
 *   - google.workspace.meet.participant.v2.joined  → Participant Joined
 *   - google.workspace.meet.participant.v2.left    → Participant Left
 */
const HandleGoogleWebhook = async (req, res) => {
  try {
    // 1. SAFELY IGNORE OLD CALENDAR WEBHOOKS
    if (req.headers['x-goog-resource-state']) {
        console.log(`[Ignored] Received legacy Calendar Webhook (State: ${req.headers['x-goog-resource-state']})`);
        return res.status(200).send("Legacy Calendar Webhook Ignored");
    }

    // 2. VALIDATE PUB/SUB PAYLOAD
    const { message, subscription } = req.body || {};

    if (!message || !message.data) {
        console.log("⚠️ Bad Request: Missing message.data in Pub/Sub payload");
        return res.status(400).send('Bad Request: Invalid Pub/Sub message format');
    }

    // Pub/Sub messages are base64 encoded
    const decodedData = Buffer.from(message.data, 'base64').toString('utf-8');
    const eventData = JSON.parse(decodedData);

    // Google maps CloudEvent headers (type, subject) to Pub/Sub Message Attributes
    const attributes = message.attributes || {};
    const eventType = attributes['ce-type'] || attributes.eventType || attributes.type || eventData.type;
    const subject = attributes['ce-subject'] || attributes.subject || eventData.subject;

    console.log(`\n--- GOOGLE MEET EVENT ---`);
    console.log(`Subscription: ${subscription}`);
    console.log(`Event Type:   ${eventType}`);
    console.log(`Subject:      ${subject}`);
    
    // Log attributes to capture exactly how Google formats them (for debug)
    console.log(`Attributes:   ${JSON.stringify(attributes)}`);

    // Conference Record ID (present in all event types)
    const conferenceRecordName = eventData.conferenceRecord?.name 
      || eventData.participantSession?.name?.split('/participants/')[0]
      || null;
    const conferenceRecordId = conferenceRecordName?.split('conferenceRecords/')[1]?.split('/')[0] || null;

    // Participant Session info (for join/leave events)
    const participantSessionName = eventData.participantSession?.name || null;
    const participantId = participantSessionName?.split('/participants/')[1]?.split('/')[0] || null;

    console.log(`Conference Record: ${conferenceRecordId || 'N/A'}`);
    console.log(`Participant:       ${participantId || 'N/A'}`);

    // 4. ROUTE EVENT TO HANDLER
    switch (eventType) {
      case "google.workspace.meet.conference.v2.started":
        await handleConferenceStarted(conferenceRecordId, conferenceRecordName);
        break;

      case "google.workspace.meet.conference.v2.ended":
        await handleConferenceEnded(conferenceRecordId, conferenceRecordName);
        break;

      case "google.workspace.meet.participant.v2.joined":
        await handleParticipantJoined(conferenceRecordId, participantId, participantSessionName);
        break;

      case "google.workspace.meet.participant.v2.left":
        await handleParticipantLeft(conferenceRecordId, participantId, participantSessionName);
        break;

      default:
        console.log(`Unhandled Google Meet event type: ${eventType}`);
        break;
    }

    return res.status(200).send('OK');

  } catch (err) {
    console.error("Google Pub/Sub Webhook Error:", err.message);
    // Acknowledge anyway so Pub/Sub doesn't infinitely retry
    return res.status(200).send('Error Processed');
  }
};

/**
 * Conference Started — First participant has joined
 * Updates the meeting record status from "scheduled" to "active"
 */
const handleConferenceStarted = async (conferenceRecordId, conferenceRecordName) => {
  console.log(`\n🟢 CONFERENCE STARTED | Record: ${conferenceRecordId}`);

  if (!conferenceRecordId) return;

  // Try to match by conference record if we already have it
  let meeting = await DB.meetings.findOne({ where: { conferenceRecordId } });

  // If not found, try to find the most recent scheduled meeting
  // (Conference record is assigned after the first join, so we may need to link it)
  if (!meeting) {
    // Find a scheduled meeting and link the conference record
    meeting = await DB.meetings.findOne({
      where: { status: "scheduled" },
      order: [["createdAt", "DESC"]]
    });

    if (meeting) {
      meeting.conferenceRecordId = conferenceRecordId;
    }
  }

  if (meeting) {
    meeting.status = "active";
    meeting.startedAt = new Date();
    await meeting.save();
    console.log(`=> Meeting #${meeting.id} marked as ACTIVE`);

    // Notify Slack about meeting going live
    await notifySlack(meeting, `🟢 *Meeting is live!* "${meeting.summary}" has started.\n🔗 ${meeting.meetingUrl}`);
  } else {
    console.log(`=> No matching meeting record found for conference: ${conferenceRecordId}`);
  }
};

/**
 * Conference Ended — All participants have left
 * Updates the meeting record status from "active" to "ended"
 */
const handleConferenceEnded = async (conferenceRecordId, conferenceRecordName) => {
  console.log(`\n🔴 CONFERENCE ENDED | Record: ${conferenceRecordId}`);

  if (!conferenceRecordId) return;

  const meeting = await DB.meetings.findOne({ where: { conferenceRecordId } });

  if (meeting) {
    meeting.status = "ended";
    meeting.endedAt = new Date();
    await meeting.save();

    const duration = meeting.startedAt 
      ? Math.round((new Date() - new Date(meeting.startedAt)) / 60000) 
      : 0;

    console.log(`=> Meeting #${meeting.id} marked as ENDED (Duration: ${duration} mins)`);

    await notifySlack(meeting, `🔴 *Meeting ended!* "${meeting.summary}" has concluded.\n⏱️ Duration: ${duration} minutes | 👥 Peak participants: ${meeting.participantCount}`);
  } else {
    console.log(`=> No matching meeting record found for conference: ${conferenceRecordId}`);
  }
};

/**
 * Participant Joined — A participant has joined the conference
 * Increments the participant count on the meeting record
 */
const handleParticipantJoined = async (conferenceRecordId, participantId, participantSessionName) => {
  console.log(`\n👋 PARTICIPANT JOINED | Conference: ${conferenceRecordId} | Participant: ${participantId}`);

  if (!conferenceRecordId) return;

  const meeting = await DB.meetings.findOne({ where: { conferenceRecordId } });

  if (meeting) {
    meeting.participantCount = (meeting.participantCount || 0) + 1;
    await meeting.save();
    console.log(`=> Meeting #${meeting.id} participant count: ${meeting.participantCount}`);
  } else {
    console.log(`=> No matching meeting record found for conference: ${conferenceRecordId}`);
  }
};

/**
 * Participant Left — A participant has left the conference
 * Decrements the participant count (floor at 0) on the meeting record
 */
const handleParticipantLeft = async (conferenceRecordId, participantId, participantSessionName) => {
  console.log(`\n👋 PARTICIPANT LEFT | Conference: ${conferenceRecordId} | Participant: ${participantId}`);

  if (!conferenceRecordId) return;

  const meeting = await DB.meetings.findOne({ where: { conferenceRecordId } });

  if (meeting) {
    meeting.participantCount = Math.max(0, (meeting.participantCount || 0) - 1);
    await meeting.save();
    console.log(`=> Meeting #${meeting.id} participant count: ${meeting.participantCount}`);
  } else {
    console.log(`=> No matching meeting record found for conference: ${conferenceRecordId}`);
  }
};

/**
 * Helper: Send Slack notification for meeting events
 */
const notifySlack = async (meeting, text) => {
  try {
    const slackIntegration = await DB.integrations.findOne({
      where: { userId: meeting.userId, type: "slack" }
    });

    if (!slackIntegration?.accessToken) return;

    const wsRepo = await DB.workspaceRepos.findOne({
      where: { workspaceId: meeting.workspaceId },
      include: [{ model: DB.slackChannels, as: "slackChannel" }]
    });

    if (wsRepo?.slackChannel?.channelId) {
      await axios.post("https://slack.com/api/chat.postMessage", {
        channel: wsRepo.slackChannel.channelId,
        text
      }, {
        headers: { Authorization: `Bearer ${slackIntegration.accessToken}` }
      });
    }
  } catch (e) {
    console.error("Slack notification failed:", e.message);
  }
};

export default HandleGoogleWebhook;
