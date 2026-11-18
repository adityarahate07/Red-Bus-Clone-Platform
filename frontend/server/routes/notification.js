const express = require("express");
const router = express.Router();
const notificationController = require("../controller/notification");

router.get("/notifications/user/:userId", notificationController.getUserNotifications);
router.post("/notifications", notificationController.createNotification);
router.post("/notifications/:id/retry", notificationController.retryNotification);
router.patch("/notifications/:id/read", notificationController.markRead);
router.patch("/notifications/user/:userId/read-all", notificationController.markAllRead);
router.put("/notifications/preferences/:userId", notificationController.updatePreferences);

module.exports = router;
