import cors from 'cors';
import express from 'express';

import { env } from './config/env';
import { errorHandler } from './middlewares/error-handler';
import { notFoundHandler } from './middlewares/not-found';
import { apiRouter } from './routes';
import { storageDirectories } from './shared/storage';

const allowedOrigins = env.CORS_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

export const app = express();
app.set('trust proxy', 1);

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('CORS origin not allowed.'));
    }
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(storageDirectories.root));

app.use('/api/v1', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
