import DB from "../../database";

const ConfluenceGetSpaces = async (req, res) => {
  try {
    const userId = req.user.id;
    const spaces = await DB.confluenceSpaces.findAll({ where: { userId } });
    return res.status(200).json(spaces);
  } catch (err) {
    console.error("ConfluenceGetSpaces Error:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

export default ConfluenceGetSpaces;
