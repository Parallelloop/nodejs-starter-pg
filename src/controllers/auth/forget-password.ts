import { signupTemplate } from "../../utils/email-template";
import { sendEmail } from "../../utils/send-email";
import DB from "../../database";
import { generateTokenResponse } from "../../middlewares/auth";
import { Request, Response } from 'express';

const ForgetPassword = async (req: Request, res: Response): Promise<Response> => {
  try {
    const {
      body: { email },
    } = req;
    
    const user = await DB.users.findOne({ where: { email } });
    if (!user) {
      return res.status(400).json("email not found");
    }
    
    const token = generateTokenResponse(user);
    
    return sendEmail(
      user.email,
      user.name,
      "Password Recovery",
      signupTemplate(user.email, token.token)
    )
      .then(() => res.status(200).json("email sent"))
      .catch((err: Error) => {
        res.status(404).json(err.message);
      });
  } catch (err) {
    return res.status(500).json((err as Error).message);
  }
};

export default ForgetPassword;
