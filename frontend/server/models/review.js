const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const reviewSchema = new Schema({
  routeKey: {
    type: String,
    required: true,
    index: true,
  },
  departureCity: {
    type: String,
    required: true,
  },
  arrivalCity: {
    type: String,
    required: true,
  },
  busId: {
    type: String,
    required: false,
  },
  operatorName: {
    type: String,
    required: false,
  },
  bookingId: {
    type: String,
    required: true,
  },
  userId: {
    type: String,
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    required: true,
    minlength: 20,
  },
  journeyDate: {
    type: String,
    required: true,
  },
  isHidden: {
    type: Boolean,
    default: false,
  },
  reportCount: {
    type: Number,
    default: 0,
  },
  reportedBy: {
    type: [String],
    default: [],
  },
  reportReasons: {
    type: [String],
    default: [],
  },
  editedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

reviewSchema.index({ userId: 1, bookingId: 1 }, { unique: true });

module.exports = mongoose.model("RouteReviews", reviewSchema);
