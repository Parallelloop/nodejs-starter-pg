import 'dotenv/config';
import express, { Express } from 'express';

import applyMiddlewares from './src/middlewares';
import router from './src/routes';

const app: Express = express();

applyMiddlewares(app);

app.use('/api/v1', router);

const PORT: number = parseInt(process.env.PORT as string, 10) || 3000;

app.listen(PORT, () => {
  console.log(`App is listening on port ${PORT}`);
});

export default app;
