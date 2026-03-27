import bcrypt from "bcryptjs";

const Users = (sequelize, DataTypes) => {
  const Users = sequelize.define("users", {
    firstName: {
      type: DataTypes.STRING(),
    },
    lastName: {
      type: DataTypes.STRING(),
    },
    email: {
      type: DataTypes.STRING(100),
    },
    password: {
      type: DataTypes.STRING(),
    },
  });
  Users.prototype.validatePassword = function (candidatePassword) {
    return bcrypt.compareSync(candidatePassword, this.password);
  };
  Users.associate = (models) => {
    Users.hasMany(models.integrations);
    Users.hasMany(models.workspaces, { foreignKey: "userId", as: "workspaces" });
    Users.hasMany(models.members, { foreignKey: "userId", as: "memberships" });
  };
  return Users;
};

export default Users;
