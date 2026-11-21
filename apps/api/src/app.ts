import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Router } from 'express';
import helmet from 'helmet';

import { apiVersionMiddleware } from './api/middlewares/apiVersion.js';
import { globalErrorHandler } from './api/middlewares/errorHandler.js';
import { notFoundMiddleware } from './api/middlewares/notFound.js';
import { requestIdMiddleware } from './api/middlewares/requestId.js';
import { requestLoggerMiddleware } from './api/middlewares/requestLogger.js';
import { createV1Router } from './api/routes/v1/index.js';
import { config } from './config/env.js';

export interface CreateAppOptions {
  registerExtraRoutes?: (v1Router: Router) => void;
}

export function createApp(options: CreateAppOptions = {}): express.Express {
  const app = express();

  app.set('trust proxy', 1);
  app.set('etag', 'weak');

  app.use(helmet());
  app.use(
    cors({
      origin: config.WEB_ORIGIN,
      credentials: true
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(apiVersionMiddleware);

  const v1Router = createV1Router();
  if (options.registerExtraRoutes) {
    options.registerExtraRoutes(v1Router);
  }
  app.use('/api/v1', v1Router);

  app.use(notFoundMiddleware);
  app.use(globalErrorHandler);

  return app;
}
