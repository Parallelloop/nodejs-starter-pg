import DB from "../../database";

const ConnectIntegration = async (req, res) => {
  try {
    const { type, accessToken, refreshToken } = req.body;
    const userId = req.user.id;

    if (!type || !accessToken) {
      return res.status(400).json({ message: "type and accessToken are required" });
    }

    if (!["github", "slack", "jira", "clickup"].includes(type)) {
      return res.status(400).json({ message: "Invalid integration type" });
    }

    // Check if integration already exists for this user
    let integration = await DB.integrations.findOne({
      where: { userId, type },
    });

    if (integration) {
      // Update existing integration
      integration.accessToken = accessToken;
      if (refreshToken) integration.refreshToken = refreshToken;
      await integration.save();
    } else {
      // Create new integration
      integration = await DB.integrations.create({
        type,
        accessToken,
        refreshToken,
        userId,
      });
    }

    return res.status(200).json({ message: "Integration connected successfully", integration });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export default ConnectIntegration;
