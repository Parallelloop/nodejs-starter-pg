import DB from "../../database";

const GetIntegrationsStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const integrations = await DB.integrations.findAll({
      where: { userId },
      attributes: ["id", "type", "createdAt", "updatedAt"]
    });

    return res.status(200).json(integrations);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export default GetIntegrationsStatus;

