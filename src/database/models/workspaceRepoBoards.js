const WorkspaceRepoBoards = (sequelize, DataTypes) => {
  const WorkspaceRepoBoards = sequelize.define("workspaceRepoBoards", {
    workspaceRepoId: {
      type: DataTypes.INTEGER,
      references: {
        model: "workspaceRepos",
        key: "id",
      },
      allowNull: false,
    },
    jiraBoardId: {
      type: DataTypes.INTEGER,
      references: {
        model: "jiraBoards",
        key: "id",
      },
      allowNull: false,
    },
  }, {
    indexes: [
      {
        unique: true,
        fields: ["workspaceRepoId", "jiraBoardId"],
      }
    ]
  });

  WorkspaceRepoBoards.associate = (models) => {
    WorkspaceRepoBoards.belongsTo(models.workspaceRepos, { foreignKey: "workspaceRepoId", as: "workspaceRepo" });
    WorkspaceRepoBoards.belongsTo(models.jiraBoards, { foreignKey: "jiraBoardId", as: "jiraBoard" });
  };

  return WorkspaceRepoBoards;
};

export default WorkspaceRepoBoards;
