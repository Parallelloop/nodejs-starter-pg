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
    commitId: {
      type: DataTypes.STRING(2000), // Store Commit URL
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
    severity: {
      type: DataTypes.STRING(20),
      defaultValue: "low", // high, medium, low
    },
    justification: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    triggeredBy: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    doneBy: {
      type: DataTypes.INTEGER,
      references: {
        model: "users",
        key: "id",
      },
      allowNull: true,
    },
  });

  SopGuard.associate = (models) => {
    SopGuard.belongsTo(models.workspaces, { foreignKey: "workspaceId" });
    SopGuard.belongsTo(models.workspaceRepos, { foreignKey: "workspaceRepoId" });
    SopGuard.belongsTo(models.slackChannels, { foreignKey: "slackChannelId" });
    SopGuard.belongsTo(models.users, { foreignKey: "doneBy", as: "user" });
  };

  return SopGuard;
};

export default SopGuard;
