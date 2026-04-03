const WorkspaceRepoSpaces = (sequelize, DataTypes) => {
  const WorkspaceRepoSpaces = sequelize.define("workspaceRepoSpaces", {
    workspaceRepoId: {
      type: DataTypes.INTEGER,
      references: {
        model: "workspaceRepos",
        key: "id",
      },
      allowNull: false,
    },
    confluenceSpaceId: {
      type: DataTypes.INTEGER,
      references: {
        model: "confluenceSpaces",
        key: "id",
      },
      allowNull: false,
    },
  }, {
    indexes: [
      {
        unique: true,
        fields: ["workspaceRepoId", "confluenceSpaceId"],
      }
    ]
  });

  WorkspaceRepoSpaces.associate = (models) => {
    WorkspaceRepoSpaces.belongsTo(models.workspaceRepos, { foreignKey: "workspaceRepoId", as: "workspaceRepo" });
    WorkspaceRepoSpaces.belongsTo(models.confluenceSpaces, { foreignKey: "confluenceSpaceId", as: "confluenceSpace" });
  };

  return WorkspaceRepoSpaces;
};

export default WorkspaceRepoSpaces;
