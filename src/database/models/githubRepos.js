const GithubRepos = (sequelize, DataTypes) => {
  const GithubRepos = sequelize.define("githubRepos", {
    repoId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    fullName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    private: {
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
        fields: ["repoId", "userId"]
      }
    ]
  });

  GithubRepos.associate = (models) => {
    GithubRepos.belongsTo(models.users, { foreignKey: "userId" });
  };

  return GithubRepos;
};

export default GithubRepos;
