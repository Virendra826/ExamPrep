import { Router } from "express";
import { AdminController } from "./admin.controller.js";
import { requireAuth, requireRole } from "../../middleware/index.js";
import { Role } from "@prisma/client";

export const adminRouter = Router();

// Protect all admin endpoints strictly to authenticated users with ADMIN role
adminRouter.use(requireAuth);
adminRouter.use(requireRole(Role.ADMIN));

adminRouter.get("/dashboard-summary", AdminController.getDashboardSummary);
