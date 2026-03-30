const JiraBoards = (sequelize, DataTypes) => {
  const JiraBoards = sequelize.define("jiraBoards", {
    boardId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    userId: {
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
        fields: ["boardId", "userId"],
      },
    ],
  });

  JiraBoards.associate = (models) => {
    JiraBoards.belongsTo(models.users, { foreignKey: "userId", as: "user" });
    JiraBoards.hasMany(models.workspaceRepoBoards, { foreignKey: "jiraBoardId", as: "workspaceRepoBoards" });
  };

  return JiraBoards;
};

export default JiraBoards;
