import DB from "../../database";

const GetSlackChannels = async (req, res) => {
  try {
    const userId = req.user.id;
    const channels = await DB.slackChannels.findAll({ where: { userId } });
    return res.status(200).json(channels);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export default GetSlackChannels;
