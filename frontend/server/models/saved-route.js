const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const savedRouteSchema = new Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
  },
  startCity: {
    type: String,
    required: true,
  },
  destinationCity: {
    type: String,
    required: true,
  },
  waypoints: {
    type: [String],
    default: [],
  },
  preferredRouteId: {
    type: String,
    default: "",
  },
  distanceKm: {
    type: Number,
    required: true,
  },
  estimatedMinutes: {
    type: Number,
    required: true,
  },
  trafficLevel: {
    type: String,
    enum: ["Low", "Moderate", "Heavy"],
    default: "Low",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("SavedRoutes", savedRouteSchema);
