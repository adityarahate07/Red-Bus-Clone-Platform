const Notification = require("../models/notification");
const Customer = require("../models/customer");

const DEFAULT_PREFS = {
  inApp: true,
  email: true,
  push: true,
  promotionalOptIn: true,
};

exports.getUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
      .exec();

    let preferences = { ...DEFAULT_PREFS };
    try {
      const customer = await Customer.findById(userId).lean().exec();
      if (customer?.notificationPreferences) {
        preferences = { ...DEFAULT_PREFS, ...customer.notificationPreferences };
      }
    } catch {
      // Non-ObjectId demo user IDs fall back to default preferences
    }

    res.json({ notifications, preferences });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Failed to load notifications" });
  }
};

exports.createNotification = async (req, res) => {
  try {
    const {
      userId,
      eventType,
      titleKey,
      messageKey,
      params,
      channels,
      language,
    } = req.body;

    if (!userId || !eventType || !titleKey || !messageKey) {
      return res.status(400).json({ error: "Missing required notification fields" });
    }

    const created = await Notification.create({
      userId,
      eventType,
      titleKey,
      messageKey,
      params: params || {},
      channels: Array.isArray(channels) ? channels : [],
      language: ["en", "hi", "mr"].includes(language) ? language : "en",
      read: false,
    });

    res.status(201).json(created);
  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({ error: "Failed to create notification" });
  }
};

exports.retryNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { channel } = req.body;

    const notif = await Notification.findById(id);
    if (!notif) {
      return res.status(404).json({ error: "Notification not found" });
    }

    notif.channels.forEach((ch) => {
      if (ch.status === "Failed" && (!channel || ch.channel === channel)) {
        ch.status = "Delivered";
        ch.attempts = (ch.attempts || 1) + 1;
        ch.lastAttemptAt = new Date();
        ch.error = "";
      }
    });

    await notif.save();
    res.json(notif);
  } catch (error) {
    console.error("Error retrying notification:", error);
    res.status(500).json({ error: "Failed to retry notification" });
  }
};

exports.markRead = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Notification.findByIdAndUpdate(
      id,
      { $set: { read: true } },
      { new: true }
    )
      .lean()
      .exec();
    if (!updated) {
      return res.status(404).json({ error: "Notification not found" });
    }
    res.json(updated);
  } catch (error) {
    console.error("Error marking notification read:", error);
    res.status(500).json({ error: "Failed to mark read" });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    const { userId } = req.params;
    await Notification.updateMany({ userId, read: false }, { $set: { read: true } });
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking all notifications read:", error);
    res.status(500).json({ error: "Failed to mark all read" });
  }
};

exports.updatePreferences = async (req, res) => {
  try {
    const { userId } = req.params;
    const prefs = {
      inApp: req.body.inApp !== false,
      email: req.body.email !== false,
      push: req.body.push !== false,
      promotionalOptIn: req.body.promotionalOptIn !== false,
    };

    try {
      await Customer.findByIdAndUpdate(
        userId,
        { $set: { notificationPreferences: prefs } },
        { new: true }
      ).exec();
    } catch {
      // Allow non-ObjectId demo user IDs to succeed cleanly
    }

    res.json(prefs);
  } catch (error) {
    console.error("Error updating notification preferences:", error);
    res.status(500).json({ error: "Failed to update notification preferences" });
  }
};
