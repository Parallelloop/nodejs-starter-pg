import express, { Express } from 'express';
import cors from 'cors';
import passport from 'passport';
import logger from 'morgan';
import bodyParser from 'body-parser';
import { Request, Response, NextFunction } from 'express';

import { LocalLoginStrategy, AuthenticationStrategy } from './auth';

const applyMiddlewares = (app: Express): void => {
  app.use(cors());
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(express.json());
  app.use(logger('common'));
  app.use(passport.initialize());
  passport.use(LocalLoginStrategy);
  passport.use(AuthenticationStrategy);

  // Optional: Add error handling middleware
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
  });
};

export default applyMiddlewares;
