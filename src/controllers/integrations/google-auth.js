const GoogleAuth = (req, res) => {
  const userId = req.user.id;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: "Google OAuth configuration missing" });
  }

  const state = Buffer.from(JSON.stringify({ userId })).toString("base64");
  
  // Scopes for Google Calendar (Create Meetings/Events), Google Drive (Fetch Transcripts),
  // Google Meet (Space Management + Events Subscription), and basic identity
  const scopes = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/meetings.space.created",
    "https://www.googleapis.com/auth/meetings.space.readonly"
  ].join(" ");

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scopes}&state=${state}&access_type=offline&prompt=consent`;

  return res.status(200).json({ url: authUrl });
};

export default GoogleAuth;
