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
  });

  DecisionLogs.associate = (models) => {
    DecisionLogs.belongsTo(models.workspaces, { foreignKey: "workspaceId", as: "workspace" });
  };

  return DecisionLogs;
};

export default DecisionLogs;
