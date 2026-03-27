const Relationships = (sequelize, DataTypes) => {
  const Relationships = sequelize.define("relationships", {
    workspaceId: {
      type: DataTypes.INTEGER,
      references: {
        model: "workspaces",
        key: "id",
      },
      allowNull: false,
    },
    sourceNodeId: {
      type: DataTypes.INTEGER,
      references: {
        model: "contextNodes",
        key: "id",
      },
      allowNull: false,
    },
    targetNodeId: {
      type: DataTypes.INTEGER,
      references: {
        model: "contextNodes",
        key: "id",
      },
      allowNull: false,
    },
    relationshipType: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    metadata: {
      type: DataTypes.JSONB,
    },
  });

  Relationships.associate = (models) => {
    Relationships.belongsTo(models.workspaces, { foreignKey: "workspaceId", as: "workspace" });
    Relationships.belongsTo(models.contextNodes, { foreignKey: "sourceNodeId", as: "sourceNode" });
    Relationships.belongsTo(models.contextNodes, { foreignKey: "targetNodeId", as: "targetNode" });
  };

  return Relationships;
};

export default Relationships;
