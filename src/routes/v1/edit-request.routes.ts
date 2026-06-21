import { Router } from 'express';
import { editRequestController } from '../../controllers/edit-request.controller';
import { validate } from '../../middleware/validate';
import { authenticate, authorize } from '../../middleware/auth';
import { createEditRequestSchema } from '../../validators/edit-request.validator';
import { UserRole } from '@prisma/client';

const router = Router();

router.post('/submission/:submissionId', authenticate, authorize(UserRole.TEACHER), validate(createEditRequestSchema), editRequestController.createEditRequest);
router.get('/submission/:submissionId', authenticate, editRequestController.getEditRequests);

export default router;
