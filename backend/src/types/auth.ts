import { Role } from "@prisma/client";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  is_active: boolean;
}

export interface AccessTokenPayload {
  sub: string;
  role: Role;
}

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */
