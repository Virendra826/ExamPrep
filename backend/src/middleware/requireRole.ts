import { type Request, type Response, type NextFunction } from "express";
import { Role } from "@prisma/client";
import { ForbiddenError, UnauthorizedError } from "../utils/errors.js";

export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError("UNAUTHORIZED", "Authentication required");
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError(
        `Forbidden: Role '${req.user.role}' is not authorized to access this resource`
      );
    }

    next();
  };
}
