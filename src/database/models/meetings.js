const Meetings = (sequelize, DataTypes) => {
  const Meetings = sequelize.define("meetings", {
    workspaceId: {
      type: DataTypes.INTEGER,
      references: {
        model: "workspaces",
        key: "id",
      },
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
    summary: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "KORE Sync Meeting",
    },
    meetingUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    calendarEventId: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    spaceId: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    conferenceRecordId: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    subscriptionId: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("scheduled", "active", "ended"),
      allowNull: false,
      defaultValue: "scheduled",
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    endedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    participantCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    conversation: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  });

  Meetings.associate = (models) => {
    Meetings.belongsTo(models.workspaces, { foreignKey: "workspaceId", as: "workspace" });
    Meetings.belongsTo(models.users, { foreignKey: "userId", as: "user" });
  };

  return Meetings;
};

export default Meetings;
