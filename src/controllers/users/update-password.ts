import DB from "../../database";
import bcrypt from "bcryptjs";
import { Request, Response } from 'express';
import { UpdatePasswordRequest } from "../../interfaces";

const updatePassword = async (req: UpdatePasswordRequest, res: Response): Promise<Response> => {
  const { email, password, newPassword } = req.body;
  
  try {
    const user = await DB.users.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) {
      return res.json({
        message: "Old password is incorrect, please try again later.",
      });
    } else {
      user.password = bcrypt.hashSync(newPassword, 10);
      await user.save();
      return res.json({
        message: "Password updated successfully",
      });
    }
  } catch (error) {
    return res.status(500).json({ message: (error as Error).message });
  }
};

export default updatePassword;
