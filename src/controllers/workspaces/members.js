import DB from "../../database";

const GetWorkspaceMembers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { workspaceId } = req.query;
    
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
       return res.status(404).json({ message: "Workspace access denied or not found" });
    }

    const members = await DB.members.findAll({
      where: { workspaceId: membership.workspace.id },
      include: [{
        model: DB.users,
        as: "user",
        attributes: ["id", "firstName", "lastName", "email"]
      }]
    });

    return res.status(200).json({
      workspaceName: membership.workspace.name,
      members: members.map(m => ({
        id: m.user.id,
        name: `${m.user.firstName} ${m.user.lastName}`,
        email: m.user.email,
        role: m.role
      }))
    });

  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export default GetWorkspaceMembers;
