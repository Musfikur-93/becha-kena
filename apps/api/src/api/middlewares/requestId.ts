import crypto from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  const id =
    typeof incoming === 'string' && incoming.trim().length > 0
      ? incoming.trim()
      : `req_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
