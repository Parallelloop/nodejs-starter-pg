const SlackChannels = (sequelize, DataTypes) => {
  const SlackChannels = sequelize.define("slackChannels", {
    channelId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    isPrivate: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
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
        fields: ["channelId", "userId"],
      },
    ],
  });

  SlackChannels.associate = (models) => {
    SlackChannels.belongsTo(models.users, { foreignKey: "userId", as: "user" });
    SlackChannels.hasMany(models.workspaceRepos, { foreignKey: "slackChannelId", as: "workspaceRepos" });
  };

  return SlackChannels;
};

export default SlackChannels;
