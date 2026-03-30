const SopGuard = (sequelize, DataTypes) => {
  const SopGuard = sequelize.define("sopGuard", {
    workspaceId: {
      type: DataTypes.INTEGER,
      references: {
        model: "workspaces",
        key: "id",
      },
      allowNull: false,
    },
    workspaceRepoId: {
      type: DataTypes.INTEGER,
      references: {
        model: "workspaceRepos",
        key: "id",
      },
      allowNull: false,
    },
    slackChannelId: {
      type: DataTypes.INTEGER,
      references: {
        model: "slackChannels",
        key: "id",
      },
      allowNull: true,
    },
    prId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    branchName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    jiraTaskIds: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false, // passed, failed, error
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  });

  SopGuard.associate = (models) => {
    SopGuard.belongsTo(models.workspaces, { foreignKey: "workspaceId" });
    SopGuard.belongsTo(models.workspaceRepos, { foreignKey: "workspaceRepoId" });
    SopGuard.belongsTo(models.slackChannels, { foreignKey: "slackChannelId" });
  };

  return SopGuard;
};

export default SopGuard;
