const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const commentSchema = new Schema({
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const reportSchema = new Schema({
  userId: { type: String, required: true },
  userName: { type: String, required: false },
  reason: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const communityPostSchema = new Schema({
  authorId: { type: String, required: true },
  authorName: { type: String, required: true },
  authorEmail: { type: String, required: false },
  authorVerified: { type: Boolean, default: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  topic: {
    type: String,
    enum: ["Routes", "Destinations", "Travel Advice"],
    required: true,
  },
  routeTag: { type: String, required: false },
  travelTips: { type: [String], default: [] },
  photoUrl: { type: String, required: false },
  likes: { type: [String], default: [] },
  comments: { type: [commentSchema], default: [] },
  reports: { type: [reportSchema], default: [] },
  status: {
    type: String,
    enum: ["published", "flagged", "hidden"],
    default: "published",
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("CommunityPosts", communityPostSchema);
