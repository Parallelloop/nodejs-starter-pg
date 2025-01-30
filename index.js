import 'dotenv/config';
import express from 'express';
const multer = require('multer');
const fs = require('fs');
const path = require('path');

import applyMiddlewares from './src/middlewares';
import router from './src/routes';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

applyMiddlewares(app);


app.use('/api/v1', router);

app.listen(process.env.PORT, () => {
  console.log(`app is listening to port ${process.env.PORT}`);
});
export default app;
