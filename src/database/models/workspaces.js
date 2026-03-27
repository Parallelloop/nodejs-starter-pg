const Workspaces = (sequelize, DataTypes) => {
  const Workspaces = sequelize.define("workspaces", {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    membersCount: {
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
  });

  Workspaces.associate = (models) => {
    Workspaces.belongsTo(models.users, { foreignKey: "userId", as: "owner" });
    Workspaces.hasMany(models.members, { foreignKey: "workspaceId", as: "members" });
  };

  return Workspaces;
};

export default Workspaces;
