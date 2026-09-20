import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requireRole, createRateLimiter } from '../../middleware/index.js';
import { ingestionController } from './ingestion.controller.js';
import { Role } from '@prisma/client';
import { MAX_FILE_SIZE_BYTES } from './ingestion.service.js';

export const ingestionRouter = Router();

// Rate limiter for PDF ingestion uploads (max 30 uploads per 15-minute window)
const uploadRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  code: 'RATE_LIMIT_EXCEEDED',
  message: 'Too many ingestion upload requests. Please try again later.',
});

// Configure memory storage for PDF processing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
});

// Admin-only PDF upload and extraction endpoint
ingestionRouter.post(
  '/upload',
  uploadRateLimiter,
  requireAuth,
  requireRole(Role.ADMIN),
  upload.single('file'),
  ingestionController.upload.bind(ingestionController)
);

// Admin-only get batch and candidate questions endpoint
ingestionRouter.get(
  '/:batchId',
  requireAuth,
  requireRole(Role.ADMIN),
  ingestionController.getById.bind(ingestionController)
);

// Admin-only submit reviewed candidate questions endpoint
ingestionRouter.post(
  '/:batchId/questions',
  requireAuth,
  requireRole(Role.ADMIN),
  ingestionController.submitQuestions.bind(ingestionController)
);
