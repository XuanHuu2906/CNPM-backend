import { Router } from 'express';
import { internalController } from '../../controllers/internal.controller';

const router = Router();

// Middleware kiểm tra x-cron-secret
router.use((req, res, next) => {
  const secret = req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  next();
});

router.post('/jobs/deadline-reminders', internalController.triggerDeadlineReminders.bind(internalController));

export default router;
