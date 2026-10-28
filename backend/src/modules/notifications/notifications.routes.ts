import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  listNotificationsController,
  markAllNotificationsReadController,
  markNotificationReadController,
  unreadNotificationCountController,
} from "./notifications.controller.js";
import {
  listNotificationsSchema,
  markAllNotificationsReadSchema,
  markNotificationReadSchema,
  unreadNotificationCountSchema,
} from "./notifications.schema.js";

const router = Router();
router.use(requireAuth);

router.get("/", validate(listNotificationsSchema), asyncHandler(listNotificationsController));
router.get("/unread-count", validate(unreadNotificationCountSchema), asyncHandler(unreadNotificationCountController));
router.patch("/read-all", validate(markAllNotificationsReadSchema), asyncHandler(markAllNotificationsReadController));
router.patch("/:id/read", validate(markNotificationReadSchema), asyncHandler(markNotificationReadController));

export default router;
