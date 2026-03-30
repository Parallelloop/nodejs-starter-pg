const WorkspaceRepos = (sequelize, DataTypes) => {
  const WorkspaceRepos = sequelize.define("workspaceRepos", {
    workspaceId: {
      type: DataTypes.INTEGER,
      references: {
        model: "workspaces",
        key: "id",
      },
      allowNull: false,
    },
    repoId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    repoFullName: {
      type: DataTypes.STRING,
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
    assignedBy: {
      type: DataTypes.INTEGER,
      references: {
        model: "users",
        key: "id",
      },
      allowNull: false,
    },
  }, {
    indexes: [
      {
        unique: true,
        fields: ["workspaceId", "repoId"]
      }
    ]
  });

  WorkspaceRepos.associate = (models) => {
    WorkspaceRepos.belongsTo(models.workspaces, { foreignKey: "workspaceId" });
    WorkspaceRepos.belongsTo(models.users, { foreignKey: "assignedBy", as: "assigner" });
    WorkspaceRepos.belongsTo(models.slackChannels, { foreignKey: "slackChannelId", as: "slackChannel" });
    WorkspaceRepos.hasMany(models.workspaceRepoBoards, { foreignKey: "workspaceRepoId", as: "workspaceRepoBoards" });
  };

  return WorkspaceRepos;
};

export default WorkspaceRepos;
