const Members = (sequelize, DataTypes) => {
  const Members = sequelize.define("members", {
    role: {
      type: DataTypes.ENUM("owner", "admin", "member", "viewer"),
      defaultValue: "member",
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      references: {
        model: "users",
        key: "id",
      },
      allowNull: false,
    },
    workspaceId: {
      type: DataTypes.INTEGER,
      references: {
        model: "workspaces",
        key: "id",
      },
      allowNull: false,
    },
  });

  Members.associate = (models) => {
    Members.belongsTo(models.users, { foreignKey: "userId", as: "user" });
    Members.belongsTo(models.workspaces, { foreignKey: "workspaceId", as: "workspace" });
  };

  return Members;
};

export default Members;
