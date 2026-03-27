import DB from "../../database";
import jwt from "jsonwebtoken";
import { sendInvitationEmail } from "../../utils/resend";

const InviteUser = async (req, res) => {
  try {
    const { email, workspaceId } = req.body;
    const userId = req.user.id;
    
    let membership;
    if (workspaceId) {
      membership = await DB.members.findOne({
        where: { userId, workspaceId },
        include: [{ model: DB.workspaces, as: "workspace" }]
      });
    } else {
      membership = await DB.members.findOne({
        where: { userId },
        include: [{ model: DB.workspaces, as: "workspace" }],
        order: [['createdAt', 'DESC']]
      });
    }

    if (!membership || !membership.workspace) {
       return res.status(404).json({ message: "Workspace context not found or access denied" });
    }

    if (membership.role !== "owner" && membership.role !== "admin") {
      return res.status(403).json({ message: "Only Admins/Owners can invite members" });
    }

    const payload = { 
      workspaceId: membership.workspace.id,
      workspaceName: membership.workspace.name,
      email,
      role: "member",
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

    await sendInvitationEmail(email, token, membership.workspace.name);

    return res.status(200).json({ message: "Invitation sent successfully" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export default InviteUser;
