import DB from "../../database";

const RemoveMember = async (req, res) => {
  try {
    const { workspaceId, targetMemberId } = req.body;
    const userId = req.user.id;

    // Check current user's membership and role in the workspace
    const currentUserMembership = await DB.members.findOne({
      where: { userId, workspaceId }
    });

    if (!currentUserMembership || currentUserMembership.role !== "owner") {
      return res.status(403).json({ message: "Only owners can remove members" });
    }

    // Check if target member is part of this workspace
    const targetMembership = await DB.members.findOne({
      where: { userId: targetMemberId, workspaceId }
    });

    if (!targetMembership) {
      return res.status(404).json({ message: "Member not found in this workspace" });
    }

    // Owner cannot delete themselves (they must delete the whole workspace or transfer ownership)
    if (targetMemberId === userId) {
      return res.status(400).json({ message: "Owners cannot remove themselves. Please transfer ownership or delete the workspace." });
    }

    await DB.members.destroy({
      where: { userId: targetMemberId, workspaceId }
    });

    // Update member count in workspace (optional if we want it to be live, but its good practice)
    await DB.workspaces.decrement('membersCount', {
      by: 1,
      where: { id: workspaceId }
    });

    return res.status(200).json({ message: "Member removed successfully" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export default RemoveMember;
