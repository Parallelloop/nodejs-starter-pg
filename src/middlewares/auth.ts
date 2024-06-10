import { TokenResponse, User } from '../interfaces';
import passport from 'passport';
import { Request } from 'express';
import jwt, { JwtPayload , Secret} from 'jsonwebtoken';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JWTstrategy, ExtractJwt, StrategyOptionsWithoutRequest } from 'passport-jwt';
import DB from '../database';
const { JWT_SECRET } = process.env;

const jwtSecret: Secret = JWT_SECRET as string;

export const generateTokenResponse = ({ id, email, name }: User, verify = false): TokenResponse => {
  let expiryTime = '365d';
  return {
    token: jwt.sign({ id, email, name }, jwtSecret, {
      expiresIn: expiryTime
    }),
    userId: id
  };
};

export const authenticateAuthToken = passport.authenticate('jwt', {
  session: false
});

// ============================ Local Login Strategy ============================ //

export const LocalLoginStrategy = new LocalStrategy(
  {
    usernameField: 'email',
    passReqToCallback: true
  },
  async (req: Request, email: string, password: string, done: (error: any, user?: any, options?: { message: string }) => void) => {
    try {
      const user = await DB.users.findOne({ where: { email } });
      console.log("🚀 ~ user:", user)
      if (!user) {
        return done(null, false, {
          message: 'Your login details could not be verified. Please try again.'
        });
      }
      const isValid = user.validatePassword(password);
      if (!isValid) {
        return done(null, false, {
          message: 'Your login details could not be verified. Please try again.'
        });
      }
      return done(null, user);
    } catch (err) {
      console.log("🚀 ~ err:", err)
      done(err);
    }
  }
);

// ============================ JWT Strategy ============================ //

export const AuthenticationStrategy = new JWTstrategy(
  {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: jwtSecret
  } as StrategyOptionsWithoutRequest,
  async (jwtPayload: JwtPayload, done: (error: any, user?: any, info?: any) => void) => {
    try {
      const user = await DB.users.findOne({ where: { id: jwtPayload.id } });
      if (!user) return done(null, false);

      return done(null, user);
    } catch (err) {
      done(err, false);
    }
  }
);
