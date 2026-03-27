const ContextNodes = (sequelize, DataTypes) => {
  const ContextNodes = sequelize.define("contextNodes", {
    workspaceId: {
      type: DataTypes.INTEGER,
      references: {
        model: "workspaces",
        key: "id",
      },
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    metadata: {
      type: DataTypes.JSONB,
    },
    embedding: {
      type: DataTypes.JSONB,
    },
  });

  ContextNodes.associate = (models) => {
    ContextNodes.belongsTo(models.workspaces, { foreignKey: "workspaceId", as: "workspace" });
    ContextNodes.hasMany(models.relationships, { foreignKey: "sourceNodeId", as: "sourceRelationships" });
    ContextNodes.hasMany(models.relationships, { foreignKey: "targetNodeId", as: "targetRelationships" });
  };

  return ContextNodes;
};

export default ContextNodes;
