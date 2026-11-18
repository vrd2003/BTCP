import Notification from '../models/Notification.js';
import { AppError } from '../utils/errors.js';
import { sendSuccess } from '../utils/respond.js';

export async function listNotifications(request, response) {
  const notifications = await Notification.find({ userId: request.user._id }).sort({ createdAt: -1 }).limit(100);
  return sendSuccess(response, 200, 'Your notifications.', { notifications });
}

export async function markRead(request, response) {
  const notification = await Notification.findOneAndUpdate(
    { _id: request.params.id, userId: request.user._id },
    { $set: { read: true } },
    { new: true }
  );
  if (!notification) throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'No notification matches this identifier.');
  return sendSuccess(response, 200, 'Notification marked as read.', { notification });
}
