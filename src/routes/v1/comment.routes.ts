import { Router } from 'express';
import { commentController } from '../../controllers/comment.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { createCommentSchema } from '../../validators/comment.validator';

const router = Router();

router.post('/submission/:submissionId', authenticate, validate(createCommentSchema), commentController.addComment);
router.get('/submission/:submissionId', authenticate, commentController.getComments);
router.delete('/:id', authenticate, commentController.deleteComment);

export default router;
