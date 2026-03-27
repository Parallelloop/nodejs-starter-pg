import DB from "../../database";

const GetUserWorkspaces = async (req, res) => {
  try {
    const userId = req.user.id;
    const memberships = await DB.members.findAll({
      where: { userId },
      include: [{ model: DB.workspaces, as: "workspace" }]
    });

    const workspaces = memberships.map(m => ({
      id: m.workspace.id,
      name: m.workspace.name,
      role: m.role,
      membersCount: m.workspace.membersCount,
      userId: m.workspace.userId
    }));

    return res.status(200).json({ workspaces });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export default GetUserWorkspaces;
