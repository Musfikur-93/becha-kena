import type { NextFunction, Request, Response } from 'express';

export interface DeprecationOptions {
  sunset: string; // RFC 7231 IMF-fixdate e.g. "Wed, 17 Feb 2027 23:59:59 GMT"
  successor: string; // Full URL to successor endpoint
}

export function deprecated(options: DeprecationOptions) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', options.sunset);
    res.setHeader('Link', `<${options.successor}>; rel="successor-version"`);
    next();
  };
}
