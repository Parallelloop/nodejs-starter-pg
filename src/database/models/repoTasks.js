const RepoTasks = (sequelize, DataTypes) => {
  const RepoTasks = sequelize.define("repoTasks", {
    workspaceRepoId: {
      type: DataTypes.INTEGER,
      references: {
        model: "workspaceRepos",
        key: "id",
      },
      allowNull: false,
    },
    branchName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    jiraKey: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    taskContent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    inTaskGenerated: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    indexes: [
      {
        unique: true,
        fields: ["workspaceRepoId", "branchName"],
      }
    ]
  });

  RepoTasks.associate = (models) => {
    RepoTasks.belongsTo(models.workspaceRepos, { foreignKey: "workspaceRepoId", as: "workspaceRepo" });
  };

  return RepoTasks;
};

export default RepoTasks;
