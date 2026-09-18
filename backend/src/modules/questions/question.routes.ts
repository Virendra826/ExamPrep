import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/index.js';
import { questionController } from './question.controller.js';
import { Role } from '@prisma/client';

export const questionRouter = Router();

// Admin-only write routes
questionRouter.post('/', requireAuth, requireRole(Role.ADMIN), questionController.create.bind(questionController));
questionRouter.patch('/:id', requireAuth, requireRole(Role.ADMIN), questionController.update.bind(questionController));
questionRouter.patch('/:id/deactivate', requireAuth, requireRole(Role.ADMIN), questionController.deactivate.bind(questionController));

// Admin-only read routes
questionRouter.get('/available-count', requireAuth, questionController.availableCount.bind(questionController));

// Admin-only read routes
questionRouter.get('/', requireAuth, requireRole(Role.ADMIN), questionController.list.bind(questionController));
questionRouter.get('/:id', requireAuth, requireRole(Role.ADMIN), questionController.getById.bind(questionController));
