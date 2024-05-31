import 'dotenv/config';
import express, { Application } from 'express';

import applyMiddlewares from './src/middlewares';
import router from './src/routes';

const app: Application = express();

applyMiddlewares(app);

app.use('/api/v1', router);

const PORT: number = parseInt(process.env.PORT as string, 10) || 3000; // Assuming PORT is a number

app.listen(PORT, () => {
  console.log(`App is listening on port ${PORT}`);
});

export default app;
