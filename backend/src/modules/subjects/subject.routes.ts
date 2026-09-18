import { Router } from "express";
import { Role } from "@prisma/client";
import { subjectController } from "./subject.controller.js";
import { subjectChaptersRouter } from "../chapters/chapter.routes.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireRole } from "../../middleware/requireRole.js";

export const subjectRouter = Router();

// Mount nested chapters router: /api/v1/subjects/:subjectId/chapters
subjectRouter.use("/:subjectId/chapters", subjectChaptersRouter);

// Read operations: accessible by any authenticated user (STUDENT or ADMIN)
subjectRouter.get("/", requireAuth, (req, res, next) => subjectController.list(req, res, next));
subjectRouter.get("/:id", requireAuth, (req, res, next) => subjectController.getById(req, res, next));

// Write & Lifecycle operations: ADMIN only
subjectRouter.post("/", requireAuth, requireRole(Role.ADMIN), (req, res, next) =>
  subjectController.create(req, res, next)
);
subjectRouter.patch("/:id", requireAuth, requireRole(Role.ADMIN), (req, res, next) =>
  subjectController.update(req, res, next)
);
subjectRouter.patch("/:id/deactivate", requireAuth, requireRole(Role.ADMIN), (req, res, next) =>
  subjectController.deactivate(req, res, next)
);
