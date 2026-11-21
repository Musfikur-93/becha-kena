import { ERROR_CODES } from '@becha-kena/shared';
import type { NextFunction, Request, Response } from 'express';

import { config } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

export const API_VERSION = '1.0.0';

export function apiVersionMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-API-Version', API_VERSION);
  res.setHeader('X-Min-Supported-Build-Android', String(config.MIN_BUILD_ANDROID));
  res.setHeader('X-Min-Supported-Build-iOS', String(config.MIN_BUILD_IOS));

  const platformHeader = req.headers['x-client-platform'];
  const buildHeader = req.headers['x-app-build'];

  if (typeof platformHeader === 'string' && typeof buildHeader === 'string') {
    const platform = platformHeader.toLowerCase();
    const buildNumber = Number(buildHeader);

    if (!Number.isNaN(buildNumber)) {
      if (platform === 'android' && buildNumber < config.MIN_BUILD_ANDROID) {
        next(
          new AppError(
            426,
            ERROR_CODES.UPGRADE_REQUIRED,
            `Please update the Android app to build ${config.MIN_BUILD_ANDROID} or newer.`
          )
        );
        return;
      }
      if (platform === 'ios' && buildNumber < config.MIN_BUILD_IOS) {
        next(
          new AppError(
            426,
            ERROR_CODES.UPGRADE_REQUIRED,
            `Please update the iOS app to build ${config.MIN_BUILD_IOS} or newer.`
          )
        );
        return;
      }
    }
  }

  next();
}
