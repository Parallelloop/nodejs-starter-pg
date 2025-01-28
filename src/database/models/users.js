import bcrypt from "bcryptjs";

const Users = (sequelize, DataTypes) => {
  const Users = sequelize.define("users", {
    firstName: {
      type: DataTypes.STRING()
    },
    lastName: {
      type: DataTypes.STRING()
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    password: {
      type: DataTypes.STRING(),
      allowNull: false,
    },
  });

  Users.prototype.validatePassword = function (candidatePassword) {
    return bcrypt.compareSync(candidatePassword, this.password);
  };

  return Users;
};

export default Users;
