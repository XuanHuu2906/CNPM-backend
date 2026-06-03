import { Router } from 'express';
import { notificationController } from '../../controllers/notification.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { getNotificationsSchema, markReadSchema } from '../../validators/notification.validator';

const router = Router();

router.get('/', authenticate, validate(getNotificationsSchema), notificationController.getNotifications);
router.get('/unread-count', authenticate, notificationController.countUnread);
router.patch('/:id/read', authenticate, validate(markReadSchema), notificationController.markAsRead);
router.patch('/read-all', authenticate, notificationController.markAllAsRead);

export default router;
