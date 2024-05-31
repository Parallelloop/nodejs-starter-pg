import DB from "../../database";
import bcrypt from "bcryptjs";
import { generateTokenResponse } from "../../middlewares/auth";
import { Request, Response } from 'express';

interface SignUpRequest extends Request {
  body: {
    email: string;
    password: string;
  };
}

const SignUp = async (req: SignUpRequest, res: Response): Promise<Response> => {
  try {
    const {
      body: { email, password },
    } = req;
    
    if (!email || !password) {
      return res.status(400).json("email, password required");
    }

    let user = await DB.users.findOne({ where: { email } });
    if (user) {
      return res.status(400).json("email already exist");
    }

    const userPassword = bcrypt.hashSync(password, 10);
    user = await DB.users.create({
      email,
      password: userPassword,
    });

    const result = await user.save();
    const token = generateTokenResponse(result);

    return res.status(200).json({
      token,
      user: result,
    });
  } catch (err) {
    return res.status(500).json((err as Error).message);
  }
};

export default SignUp;
