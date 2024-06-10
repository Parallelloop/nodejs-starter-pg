import bcrypt from "bcryptjs";

const Users = (sequelize: any, DataTypes: any) => {
  const Users = sequelize.define("users", {
    email: {
      type: DataTypes.STRING(100),
    },
    password: {
      type: DataTypes.STRING(),
    },
  });
  Users.prototype.validatePassword = function (candidatePassword: any) {
    return bcrypt.compareSync(candidatePassword, this.password);
  };
  return Users;
};

export default Users;
