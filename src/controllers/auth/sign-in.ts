import { generateTokenResponse } from '../../middlewares/auth';
import { Request, Response } from 'express';

const SignIn = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (req.error) return res.status(401).json(req.error);
    const token = generateTokenResponse(req.user);
    return res.status(200).json({
      token,
      user: req.user
    });
  } catch (err) {
    return res.status(500).json({ message: (err as Error).message });
  }
};

export default SignIn;
