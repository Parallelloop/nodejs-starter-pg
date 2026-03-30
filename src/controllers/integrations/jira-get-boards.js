import DB from "../../database";

const JiraGetBoards = async (req, res) => {
  try {
    const userId = req.user.id;
    const boards = await DB.jiraBoards.findAll({ where: { userId } });
    return res.status(200).json(boards);
  } catch (err) {
    console.error("JiraGetBoards Error:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

export default JiraGetBoards;
