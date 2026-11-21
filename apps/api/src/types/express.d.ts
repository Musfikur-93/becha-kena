import type { UserRole } from '@becha-kena/shared';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  isSellerVerified: boolean;
  deviceId?: string;
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: AuthenticatedUser;
      deviceId?: string;
    }
  }
}

export {};
