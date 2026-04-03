const ConfluenceSpaces = (sequelize, DataTypes) => {
  const ConfluenceSpaces = sequelize.define("confluenceSpaces", {
    spaceId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    key: {
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
        fields: ["spaceId", "userId"],
      },
    ],
  });

  ConfluenceSpaces.associate = (models) => {
    ConfluenceSpaces.belongsTo(models.users, { foreignKey: "userId", as: "user" });
    ConfluenceSpaces.hasMany(models.workspaceRepoSpaces, { foreignKey: "confluenceSpaceId", as: "workspaceRepoSpaces" });
  };

  return ConfluenceSpaces;
};

export default ConfluenceSpaces;
