const Integrations = (sequelize, DataTypes) => {
  const Integrations = sequelize.define("integrations", {
    type: {
      type: DataTypes.ENUM("github", "slack", "jira", "clickup"),
      allowNull: false,
    },
    accessToken: {
      type: DataTypes.STRING(5000),
      allowNull: false,
    },
    refreshToken: {
      type: DataTypes.STRING(5000),
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

  Integrations.associate = (models) => {
    Integrations.belongsTo(models.users);
  };

  return Integrations;
};

export default Integrations;
