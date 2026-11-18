const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const channelDeliverySchema = new Schema(
  {
    channel: {
      type: String,
      enum: ["in_app", "email", "push"],
      required: true,
    },
    status: {
      type: String,
      enum: ["Sent", "Delivered", "Failed"],
      default: "Sent",
    },
    attempts: {
      type: Number,
      default: 1,
    },
    lastAttemptAt: {
      type: Date,
      default: Date.now,
    },
    error: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const notificationSchema = new Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  eventType: {
    type: String,
    enum: [
      "booking_confirmation",
      "cancellation",
      "schedule_change",
      "journey_reminder",
      "promotional_offer",
    ],
    required: true,
  },
  titleKey: {
    type: String,
    required: true,
  },
  messageKey: {
    type: String,
    required: true,
  },
  params: {
    type: Schema.Types.Mixed,
    default: {},
  },
  channels: {
    type: [channelDeliverySchema],
    default: [],
  },
  language: {
    type: String,
    enum: ["en", "hi", "mr"],
    default: "en",
  },
  read: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Notifications", notificationSchema);
