const DecisionLogs = (sequelize, DataTypes) => {
  const DecisionLogs = sequelize.define("decisionLogs", {
    workspaceId: {
      type: DataTypes.INTEGER,
      references: {
        model: "workspaces",
        key: "id",
      },
      allowNull: false,
    },
    title: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    rationale: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    linkedJiraId: {
      type: DataTypes.STRING(100),
    },
    linkedPrId: {
      type: DataTypes.STRING(100),
    },
    sopGuardId: {
      type: DataTypes.INTEGER,
      references: {
        model: "sopGuards",
        key: "id",
      },
      allowNull: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      references: {
        model: "users",
        key: "id",
      },
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "architecture",
    },
  });

  DecisionLogs.associate = (models) => {
    DecisionLogs.belongsTo(models.workspaces, { foreignKey: "workspaceId", as: "workspace" });
    DecisionLogs.belongsTo(models.sopGuard, { foreignKey: "sopGuardId", as: "sopGuard" });
    DecisionLogs.belongsTo(models.users, { foreignKey: "userId", as: "user" });
  };

  return DecisionLogs;
};

export default DecisionLogs;
