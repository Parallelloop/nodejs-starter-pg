import DB from "../../database";

const CreateWorkspace = async (req, res) => {
  try {
    const { name, membersCount } = req.body;
    const userId = req.user.id;

    if (!name) return res.status(400).json({ message: "Workspace name is required" });

    const workspace = await DB.workspaces.create({
      name,
      membersCount,
      userId,
    });

    return res.status(201).json({ message: "Workspace created successfully", workspace });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export default CreateWorkspace;
