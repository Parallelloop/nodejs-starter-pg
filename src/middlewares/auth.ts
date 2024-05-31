import passport from 'passport';
import jwt, { JwtPayload } from 'jsonwebtoken';
import LocalStrategy from 'passport-local';
import { Strategy as JWTstrategy, ExtractJwt, StrategyOptions } from 'passport-jwt';
import DB from '../database';

interface User {
  id: number;
  email: string;
  name: string;
}

// const { JWT_SECRET }: { JWT_SECRET: string | undefined } = process?.env;

export interface TokenResponse {
  token: string;
  userId: number;
}

export const generateTokenResponse = ({ id, email, name }: User, verify = false): TokenResponse => {
  let expiryTime = '365d';
  return {
    token: jwt.sign({ id, email, name }, "12345", {
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
  async (req, email, password, done) => {
    try {
      const user = await DB.users.findOne({ where: { email } });
      if (!user) {
        return done(null, false, {
          error: 'Your login details could not be verified. Please try again.'
        });
      }
      const isValid = user.validatePassword(password);
      if (!isValid) {
        return done(null, false, {
          error: 'Your login details could not be verified. Please try again.'
        });
      }
      return done(null, user);
    } catch (err) {
      done(err);
    }
  }
);

// ============================ JWT Strategy ============================ //

export const AuthenticationStrategy = new JWTstrategy(
  {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: "12345"
  } as StrategyOptions,
  async (jwtPayload: JwtPayload, done) => {
    try {
      const user = await DB.users.findOne({ where: { id: jwtPayload.id } });
      if (!user) return done(null, false);

      return done(null, user);
    } catch (err) {
      done(err, false);
    }
  }
);
