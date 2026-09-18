import { Router } from "express";
import { Role } from "@prisma/client";
import { chapterController } from "./chapter.controller.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireRole } from "../../middleware/requireRole.js";

// Main chapters router for /api/v1/chapters
export const chapterRouter = Router();

// Read operation: any authenticated user
chapterRouter.get("/:id", requireAuth, (req, res, next) => chapterController.getById(req, res, next));

// Admin-only write & lifecycle operations
chapterRouter.post("/", requireAuth, requireRole(Role.ADMIN), (req, res, next) =>
  chapterController.create(req, res, next)
);
chapterRouter.patch("/:id", requireAuth, requireRole(Role.ADMIN), (req, res, next) =>
  chapterController.update(req, res, next)
);
chapterRouter.patch("/:id/deactivate", requireAuth, requireRole(Role.ADMIN), (req, res, next) =>
  chapterController.deactivate(req, res, next)
);

// Nested router for /api/v1/subjects/:subjectId/chapters
export const subjectChaptersRouter = Router({ mergeParams: true });
subjectChaptersRouter.get("/", requireAuth, (req, res, next) =>
  chapterController.listBySubject(req, res, next)
);
