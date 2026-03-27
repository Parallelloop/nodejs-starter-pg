import axios from "axios";

export const sendInvitationEmail = async (email, token, workspaceName) => {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured. Email bypassed.");
    return false;
  }

  const appLink = process.env.APP_LINK || "http://localhost:5173/";
  const link = `${appLink}signup?token=${token}&workspaceName=${encodeURIComponent(workspaceName)}`;

  const payload = {
    from: "Kore <onboarding@resend.dev>",
    to: [email],
    subject: `You have been invited to join ${workspaceName} on Kore`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>You're Invited!</h2>
        <p>You have been invited to collaborate with your team in <strong>${workspaceName}</strong>.</p>
        <div style="margin: 30px 0;">
          <a href="${link}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Accept Invitation</a>
        </div>
        <p>Welcome aboard,</p>
        <p>The Kore Team</p>
      </div>
    `
  };

  try {
    await axios.post("https://api.resend.com/emails", payload, {
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      }
    });
    return true;
  } catch (error) {
    console.error("Failed to send Resend email:", error.response?.data || error);
    throw new Error("Email dispatch system failed");
  }
};
