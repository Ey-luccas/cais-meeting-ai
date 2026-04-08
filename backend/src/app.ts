import express from 'express';
import cors from 'cors';

import { env } from './config/env';
import { errorHandler } from './middlewares/error-handler';
import { notFoundHandler } from './middlewares/not-found';
import { appRouter } from './routes';
import { uploadDirAbsolutePath } from './utils';

export const app = express();

const allowedOrigins = env.CORS_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

app.use(
  cors({
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

app.use('/uploads', express.static(uploadDirAbsolutePath));
app.use(appRouter);
app.use('/api/v1', appRouter);

app.use(notFoundHandler);
app.use(errorHandler);
